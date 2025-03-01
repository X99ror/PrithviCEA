import { NextResponse } from "next/server";
import { google } from "googleapis";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request, { params }) {
  try {
    const { topic } = params;

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

    const formData = await request.formData();
    const name = formData.get("name");
    const email = formData.get("email");
    const number = formData.get("number");
    const alternateNumber = formData.get("alternateNumber");
    const instituteId = formData.get("instituteId");
    const instituteName = formData.get("instituteName");
    const paymentProof = formData.get("paymentProof");

    if (!paymentProof) {
      return NextResponse.json(
        { message: "Payment proof upload is required", success: false },
        { status: 400 }
      );
    }

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

    const imageUrl = await uploadImageToDrive(auth, paymentProof);

    const sheets = google.sheets({ auth, version: "v4" });
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: "A1:G1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[name, email, number, alternateNumber, instituteId, instituteName, imageUrl]],
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Google Sheets Error:", error);
    return NextResponse.json(
      { status: 500, success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}

async function uploadImageToDrive(auth, paymentProof) {
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = { name: paymentProof.name, parents: [process.env.GOOGLE_DRIVE_ID] };
  const media = { mimeType: paymentProof.type, body: paymentProof.stream() };

  let retries = 3;
  while (retries > 0) {
    try {
      const file = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id",
      });

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
