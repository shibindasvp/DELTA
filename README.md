# Delta User Module — ES Modules

## Stack
Node.js, Express, MongoDB/Mongoose, EJS, JavaScript, bcryptjs, JWT cookies, Passport Google/Facebook, Nodemailer, Multer.

## Features
- Home page
- Signup validation
- Signup OTP with 60-second expiry
- OTP resend
- Login
- JWT authentication in HTTP-only cookie
- Google OAuth
- Facebook OAuth
- Forgot password with OTP
- Reset password
- Profile display
- Separate profile edit page
- Profile image upload
- Email change verification with OTP
- Change password
- Address add/edit/delete
- Default address
- User-specific address authorization

## Setup

1. Copy `.env.example` to `.env`.
2. Fill MongoDB and email settings.
3. For Google/Facebook SSO, create OAuth apps and fill the credentials.
4. Run:

npm install
npm run dev

Open:

http://localhost:3035

## Important OAuth callback URLs

Google:
http://localhost:3035/auth/google/callback



## Important
For Gmail SMTP, use a Google App Password rather than your normal Gmail password.

The signup password is hashed before it is stored in the temporary OTP payload.

OTP documents expire automatically using MongoDB TTL.

For production:
- use HTTPS
- set secure cookies
- add CSRF protection for form posts
- add rate limiting to login/OTP routes
- use Cloudinary/S3 instead of local image storage
- use a persistent session store only if session-based authentication is later introduced
- never commit `.env`
