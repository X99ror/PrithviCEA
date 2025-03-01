import { NextResponse } from "next/server";
import { google } from "googleapis";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request, { params }) {
  try {
    console.log("Request received");

    const { topic } = params;
    console.log("Topic:", topic);

    if (!topic) {
      return NextResponse.json(
        { message: "Topic parameter is required", success: false },
        { status: 400 }
      );
    }

    let id;
    if (topic === "Lecture1") {
      id = process.env.GOOGLE_SHEET_ID;
    } else if (topic === "AutoCAD Design Competition") {
      id = process.env.WORKSHOP_SHEET_ID;
    } else {
      id = process.env.GOOGLE_SHEET_ID2;
    }
    console.log("Sheet ID:", id);

    const formData = await request.formData();
    console.log("Form data parsed");

    const name = formData.get("name");
    const email = formData.get("email");
    const number = formData.get("number");
    const alternateNumber = formData.get("alternateNumber");
    const instituteId = formData.get("instituteId");
    const instituteName = formData.get("instituteName");
    const paymentProof = formData.get("paymentProof");

    console.log("Extracted form data");

    if (!paymentProof) {
      return NextResponse.json(
        { message: "Payment proof upload is required", success: false },
        { status: 400 }
      );
    }

    console.log("Payment proof found");

    console.log("Processing in background");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    console.log("Google auth initialized");

    const imageUrl = await uploadImageToDrive(auth, paymentProof);
    console.log("Image URL:", imageUrl);

    const sheets = google.sheets({ auth, version: "v4" });

    const lastRow = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: "Sheet1!A:A",
    });
    console.log("Last row retrieved:", lastRow.data.values);

    const nextRow = lastRow.data.values ? lastRow.data.values.length + 1 : 1;
    console.log("Next row:", nextRow);

    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `Sheet1!A${nextRow}:G${nextRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[name, email, number, alternateNumber, instituteId, instituteName, imageUrl]],
      },
    });

    console.log("Data appended to Google Sheets");

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Processing your request, you will be notified soon.",
    });

  } catch (error) {
    console.error("Error in background task:", error);
    return NextResponse.json(
      { status: 500, success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}

async function uploadImageToDrive(auth, paymentProof) {
  console.log("Uploading image to Drive");

  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: paymentProof.name,
    parents: [process.env.GOOGLE_DRIVE_ID],
  };
  const media = {
    mimeType: paymentProof.type,
    body: paymentProof.stream ? paymentProof.stream() : paymentProof.buffer(),
  };

  console.log("File metadata:", fileMetadata);
  console.log("Media type:", media.mimeType);

  let retries = 3;
  while (retries > 0) {
    try {
      const file = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id",
      });

      console.log("File uploaded to Drive:", file.data.id);

      await drive.permissions.create({
        fileId: file.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });

      return `https://drive.google.com/uc?id=${file.data.id}`;
    } catch (error) {
      console.error("Drive upload error (retries left:", retries, "):", error);
      retries--;
      if (retries === 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}