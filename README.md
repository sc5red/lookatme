# LookAtMe Social Network Application

A modern social networking application built with Node.js, Express, EJS, and PostgreSQL.

## Features

- **Authentication System**: Complete login/registration with bcrypt password hashing
- **Dark/Light Mode Toggle**: Cross-browser compatible theme switching with localStorage persistence  
- **Friends Online Panel**: Real-time friend status with database integration
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **Profile Management**: User profiles with customizable information
- **Settings Panel**: Privacy settings, appearance preferences, and account management

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with connection pooling
- **Frontend**: EJS templating with Tailwind CSS v4
- **Authentication**: bcrypt for password hashing, express-session for session management
- **Icons**: Lucide Icons

## Setup Instructions

### Prerequisites
1. **Node.js** (v14 or higher)
2. **PostgreSQL** (v12 or higher)
3. **npm** package manager

### Installation
1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup PostgreSQL Database**
   - Install PostgreSQL on your system
   - Create a database named `lookatme_db`
   - Update database credentials in `config/database.js` if needed

3. **Start the application**
   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and visit: `http://localhost:3000`

## Usage

### Authentication
- Click "Login" to access the authentication modal
- Register a new account or login with existing credentials
- Session persists for 24 hours

### Profile Management  
- Access `/profile` to view and edit your profile
- Update name, bio, and other profile information

### Settings
- Access `/settings` for account and privacy settings
- Change password, email, and notification preferences
