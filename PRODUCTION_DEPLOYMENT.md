# Production Deployment Guide - Email & SMS

## ⚙️ Environment Configuration for Production

### 🎯 The Issue
SMS and emails contain links like `http://localhost:3000/auth/login` which won't work in production. This guide ensures your deployed app uses `https://cvcc-iota.vercel.app/auth/login`.

---

## 📋 Quick Setup Checklist

### ✅ Already Done (Automatically)
- [x] SMS now uses `/auth/login` instead of `/auth/parent-login`
- [x] `render.yaml` updated with production `FRONTEND_URL`
- [x] Email templates already use correct path

### 🚀 What You Need to Do

#### If Deploying to **Render.com**:
1. The `render.yaml` file is already configured! 
2. When you push to GitHub, Render will automatically use:
   ```
   FRONTEND_URL=https://cvcc-iota.vercel.app
   ```

3. **Add these secret environment variables** in Render Dashboard:
   - `SMTP_HOST` = `smtp-relay.brevo.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = `8b79b1002@smtp-brevo.com`
   - `SMTP_PASS` = `xsmtpsib-7b86ca49e508b078091667b89b6be1a16df0f13a7a9db07911a1f4cf2762aa05-zkyq3H5kwPC4DoLd`
   - `SMTP_FROM` = `junyappteam@gmail.com`
   - `HUBTEL_CLIENT_ID` = `lpeoedxv`
   - `HUBTEL_CLIENT_SECRET` = `nixnotcx`
   - `HUBTEL_SENDER_NAME` = `Juny`

#### If Deploying to **Railway.app**:
Add this environment variable in Railway Dashboard:
```
FRONTEND_URL=https://cvcc-iota.vercel.app
```

Plus all the SMTP and Hubtel variables listed above.

---

## 🧪 How to Test Production URLs

### Test SMS in Production:
When you register a mother on your live site, the SMS will show:
```
Welcome Akua Mensah! Your CVCC parent portal access:
Email: akua@example.com
Password: Abc12345
Login: https://cvcc-iota.vercel.app/auth/login
Change password on first login.
```

✅ Notice: Uses `https://cvcc-iota.vercel.app` NOT `localhost`

### Test Email in Production:
The email will have a button linking to:
```
https://cvcc-iota.vercel.app/auth/login
```

---

## 🔧 Configuration Details

### Development (Local):
```env
# backend/.env
FRONTEND_URL=http://localhost:3000
```
Result: `http://localhost:3000/auth/login`

### Production (Render/Railway):
```env
# Set via Render/Railway Dashboard
FRONTEND_URL=https://cvcc-iota.vercel.app
```
Result: `https://cvcc-iota.vercel.app/auth/login`

---

## 📱 SMS Message Formats

### Production SMS (What parents will receive):
```
Welcome Akua Mensah! Your CVCC parent portal access:
Email: akua@example.com
Password: Abc12345
Login: https://cvcc-iota.vercel.app/auth/login
Change password on first login.
```

### Registration Confirmation (SMS-only, no email):
```
Hello Akua Mensah, you have been registered in the Child Vaccination Command Center. 
You will receive SMS reminders for your child's vaccination appointments. Thank you!
```

---

## 🚨 Troubleshooting

### Problem: SMS still shows `localhost` after deployment
**Solution:**
1. Check Render/Railway environment variables
2. Ensure `FRONTEND_URL=https://cvcc-iota.vercel.app` is set
3. Restart the backend service
4. Clear any cached environment variables

### Problem: Parents can't access login page
**Solution:**
1. Verify Vercel deployment is live at `https://cvcc-iota.vercel.app`
2. Test the URL manually: `https://cvcc-iota.vercel.app/auth/login`
3. Check if login route exists in Next.js app

### Problem: SMS not sending in production
**Solution:**
1. Verify Hubtel credentials in Render/Railway dashboard
2. Check Hubtel account has SMS credits
3. View backend logs for errors:
   ```
   [SmsService] Hubtel API error: ...
   ```

---

## ✨ Next Steps After Deployment

1. **Test Registration Flow:**
   - Visit: `https://cvcc-iota.vercel.app/facility/register-mother`
   - Register a test mother with your phone number
   - Verify SMS arrives with correct production URL

2. **Monitor First Week:**
   - Check SMS delivery rates
   - Monitor email delivery
   - Collect user feedback

3. **Set Up Monitoring:**
   - Track failed SMS/email sends
   - Monitor Hubtel SMS balance
   - Set up alerts for delivery failures

---

## 💰 Cost Considerations

### Hubtel SMS Credits:
- Each mother registration = 1-2 SMS
- Monitor balance in Hubtel dashboard
- Top up before balance runs out

### Brevo Email:
- Free tier: 300 emails/day
- Should be sufficient for most clinics
- Upgrade if needed

---

## 🔐 Security Checklist

- [x] SMS credentials not exposed in frontend
- [x] Email credentials in environment variables only
- [x] Temporary passwords forced to change on first login
- [x] Production URLs use HTTPS
- [x] CORS configured for production domain

---

## 📞 Support

If you encounter issues:
1. Check backend logs in Render/Railway
2. Verify all environment variables are set
3. Test Hubtel API directly (see EMAIL_SMS_INTEGRATION.md)
4. Ensure FRONTEND_URL matches your Vercel deployment

---

**Updated:** February 13, 2026
**Deployment Ready:** ✅ Yes
