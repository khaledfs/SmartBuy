# SmartBuy - Shopping List App

## Project Description
SmartBuy is a mobile shopping list application built with React Native and Node.js. It helps users create shopping lists, get product suggestions, and collaborate with others in real-time. The app supports both English and Hebrew languages.

## Features
- **User Authentication**: Sign up and login with username or phone number
- **Shopping Lists**: Create and manage personal shopping lists
- **Product Suggestions**: Browse suggested products with images and Hebrew names
- **Real-time Collaboration**: Work on shopping lists with others simultaneously
- **Group Management**: Create groups and manage members
- **Location-based Features**: Get location-specific product recommendations
- **Smart Suggestions**: AI-powered recommendations based on purchase history from 120+ households
- **Price Comparison**: Compare prices across different supermarkets
- **Global & Personal Recommendations**: See most popular products and personalized suggestions

## Technology Stack
- **Frontend**: React Native (Expo)
- **Backend**: Node.js with Express
- **Database**: MongoDB Atlas
- **Real-time**: Socket.io
- **Authentication**: JWT tokens

## Installation & Setup

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager
- MongoDB Atlas account
- Expo Go app on your mobile device

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd SmartBuy
```

### Step 2: Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Step 3: Environment Configuration
Create a `.env` file in the `server` directory:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=5000
```

### Step 4: Update IP Address
Edit `client/services/api.js` and change the IP address to your computer's local IP:
```javascript
const api = axios.create({ baseURL: 'http://YOUR_IP:5000/api' });
```

### Step 5: Start the Application
```bash
# Start backend server
cd server
npm start

# Start frontend (in a new terminal)
cd client
npx expo start
```

### Step 6: Run on Mobile Device
1. Install Expo Go app on your phone
2. Scan the QR code displayed in the terminal
3. Make sure your phone and computer are on the same WiFi network

## How to Use

### Creating an Account
1. Open the app and tap "Sign Up"
2. Enter a unique username and phone number
3. Choose a password (minimum 6 characters)
4. Optionally add a profile picture
5. Tap "Create Account"

### Using Shopping Lists
1. After login, you'll see suggested products
2. Tap "Add to List" to add items to your shopping list
3. Navigate to "My List" to view and manage your items
4. Mark items as bought by tapping the checkmark

### Group Features
1. Create a group from the main screen
2. Invite others by sharing the group
3. All group members can edit the shared shopping list
4. Changes appear in real-time for everyone

## Project Structure
```
SmartBuy/
├── client/                 # React Native frontend
│   ├── screens/           # App screens
│   ├── services/          # API and socket services
│   └── assets/            # Images and animations
├── server/                # Node.js backend
│   ├── controllers/       # Business logic
│   ├── models/           # Database models
│   ├── routes/           # API endpoints
│   └── scripts/          # Data seeding
└── README.md
```

## Development Notes
- The app uses MongoDB Atlas for data storage
- Real-time updates are handled with Socket.io
- Authentication uses JWT tokens stored in AsyncStorage
- Product data is loaded from a local JSON file
- The app supports both English and Hebrew interfaces

## Troubleshooting
- **Connection Issues**: Ensure both devices are on the same WiFi network
- **Authentication Errors**: Check that JWT_SECRET is set in .env file
- **Database Errors**: Verify MongoDB connection string is correct
- **App Not Loading**: Make sure both backend and frontend are running

## Milestones Completed
- **Milestone 1**: Basic app setup, authentication, and shopping lists
- **Milestone 2**: Real-time collaboration, group management, and enhanced UI
- **Milestone 3**: Smart features including AI-powered recommendations and price comparison

## Future Improvements
- Implement barcode scanning
- Add offline mode support
- Add push notifications
- Machine learning-based predictions

## Contact
For questions or support, contact the development team.

---
*This project was developed as part of a school assignment demonstrating full-stack mobile development skills.*
