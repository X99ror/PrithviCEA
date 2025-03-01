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

    // Just get the file name without uploading to Drive
    const paymentProofName = paymentProof.name || "payment_proof";

    // Set up Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    // Add data to Google Sheet
    const sheets = google.sheets({ auth, version: "v4" });
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: "A1:G1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            name,
            email,
            number,
            alternateNumber,
            instituteId,
            instituteName,
            paymentProofName, // Just using the file name instead of Drive URL
          ],
        ],
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Registration successful!",
      data: response.data,
    });
  } catch (error) {
    console.error("Google Sheets Error:", error);
    return NextResponse.json(
      { 
        status: 500, 
        success: false, 
        message: "Something went wrong", 
        error: error.message 
      },
      { status: 500 }
    );
  }
}