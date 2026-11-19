import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const getTransporter = () => {
    const emailUser = (process.env.EMAIL_USER || process.env.MAIL_USER || "").trim();
    const emailPass = (process.env.EMAIL_PASSWORD || process.env.MAIL_PASS || "").trim();

    if (!emailUser || !emailPass) {
        return null;
    }

    const host = process.env.MAIL_HOST || "smtp.gmail.com";
    const port = Number(process.env.MAIL_PORT) || 587;
    const isGmail = host.includes("gmail") || emailUser.endsWith("@gmail.com");

    if (isGmail) {
        return nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: emailUser,
                pass: emailPass
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user: emailUser,
            pass: emailPass
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

export const sendOTPEmail = async ({
    to,
    otp,
    purpose
}) => {
    const purposeText =
        purpose === "signup"
            ? "verify your DELTA account"
            : purpose === "forgot-password" || purpose === "admin-forgot-password"
                ? "reset your DELTA password"
                : "verify your new email address";

    const emailUser = (process.env.EMAIL_USER || process.env.MAIL_USER || "").trim();

    // Always log OTP clearly in development console
    console.log("DELTA AUTHENTICATION OTP DISPATCH");
    console.log("Recipient:", to);
    console.log("Purpose:", purpose);
    console.log("OTP Code:", otp);
    console.log("Expires in: 5 minutes");

    const transporter = getTransporter();

    if (transporter) {
        try {
            await transporter.sendMail({
                from: process.env.MAIL_FROM || `"DELTA Haute Horlogerie" <${emailUser}>`,
                to,
                subject: `DELTA Luxury Watches — Verification Code: ${otp}`,
                text: `Your DELTA verification code is ${otp}. This code is valid for 5 minutes. Purpose: ${purposeText}.`,
                html: `
                    <div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; padding: 32px; color: #18181b;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <div style="font-size: 28px; font-weight: bold; font-family: serif; color: #004D2C; letter-spacing: 2px;">DELTA</div>
                            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #71717a; margin-top: 4px;">HAUTE HORLOGERIE</div>
                        </div>
                        <div style="border-top: 1px solid #f4f4f5; border-bottom: 1px solid #f4f4f5; padding: 24px 0; text-align: center;">
                            <p style="font-size: 13px; color: #52525b; margin-bottom: 16px;">
                                Use the following single-use verification code to <strong>${purposeText}</strong>:
                            </p>
                            <div style="display: inline-block; background-color: #fafafa; border: 1px dashed #004D2C; border-radius: 6px; padding: 14px 28px; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 8px; color: #004D2C;">
                                ${otp}
                            </div>
                            <p style="font-size: 11px; color: #a1a1aa; margin-top: 16px;">
                                Valid for <strong>5 minutes</strong>. Never share this code with anyone.
                            </p>
                        </div>
                        <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #a1a1aa;">
                            If you did not request this verification code, please disregard this transmission.<br>
                            &copy; ${new Date().getFullYear()} DELTA Horology. All rights reserved.
                        </div>
                    </div>
                `
            });
            console.log(`Real SMTP email successfully delivered to: ${to}`);
        } catch (emailErr) {
            console.error(`✗ SMTP delivery failed for ${to}:`, emailErr.message);
        }
    } else {
        console.log(`ℹ Note: EMAIL_USER / EMAIL_PASSWORD is not set in .env. OTP was printed above for testing.`);
    }

    return true;
};
