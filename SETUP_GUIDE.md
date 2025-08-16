# 🔧 SmartBuy Setup Guide - Fix Authentication Timeout Issues

## 🚨 Critical Issue: Authentication Timeouts

The client is experiencing timeout errors during login/signup. Here's how to fix it:

## 📋 Required Environment Variables

Create a `.env` file in the `server` directory with these variables:

```env
# MongoDB Connection String (REQUIRED)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/smartbuy?retryWrites=true&w=majority

# JWT Secret Key (REQUIRED - This was missing!)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random_at_least_32_characters

# Server Port (optional)
PORT=5000
```

## 🔍 What Was Wrong

1. **Missing JWT_SECRET**: The authentication was failing because `JWT_SECRET` wasn't defined
2. **No Request Timeouts**: API requests were hanging indefinitely
3. **Poor Error Handling**: Errors weren't being properly reported

## ✅ What I Fixed

### 1. Added Request Timeouts
- Set 10-second timeout for API requests
- Added better error handling for network issues

### 2. Improved Server Error Handling
- Added environment variable validation
- Better MongoDB connection error handling
- Added health check endpoint

### 3. Enhanced Authentication Controller
- Added detailed logging for debugging
- MongoDB connection status checks
- Better error messages

## 🚀 Quick Fix Steps

1. **Create `.env` file** in `server/` directory with the variables above
2. **Update IP address** in `client/services/api.js` to match your server IP
3. **Restart the server** after adding the `.env` file
4. **Test the connection** by visiting `http://your-ip:5000/api/health`

## 🧪 Testing

1. **Server Health Check**: `http://your-ip:5000/api/health`
2. **Backend Test**: `http://your-ip:5000/` (should show "✅ Backend is working")

## 🔧 Troubleshooting

### If still getting timeouts:
1. Check if MongoDB is accessible
2. Verify the IP address in `client/services/api.js`
3. Ensure both client and server are on the same network
4. Check server console for error messages

### Common Issues:
- **Wrong IP**: Update `client/services/api.js` with correct server IP
- **MongoDB Connection**: Verify your MongoDB Atlas connection string
- **Network**: Ensure both devices are on the same WiFi network

## 📱 Client Configuration

The client needs to update the IP address in:
```
client/services/api.js
```

Change this line:
```javascript
baseURL: 'http://192.168.201.100:5000/api'
```

To match your server's IP address.

## 🎯 Expected Behavior After Fix

- Login/signup should complete within 10 seconds
- Clear error messages if something goes wrong
- Server console will show detailed logs for debugging 