# BasketIQ Smart Retail Platform

BasketIQ is a full-stack smart retail administration platform built for practical product, billing, inventory, and reporting workflows. It brings together POS billing, GST-ready invoicing, stock control, customer management, analytics, and role-based access in one business-focused dashboard.

The project follows a clean two-app architecture:

- `frontend/`: React + Vite admin dashboard
- `backend/`: Node.js + Express + MongoDB API

## Live Demo

- Live Frontend: https://basketiq-smart-retail-platform.vercel.app
- Backend API: https://basketiq-backend.onrender.com

## Demo Credentials

### Admin

- Email: `admin@test.com`
- Password: `123456`

### Staff

- Email: `staff@test.com`
- Password: `123456`

## Deployment Stack

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Core Modules

- Authentication with `admin` and `staff` role support
- Product management with GST slab configuration
- Inventory tracking with stock movement history and low-stock visibility
- POS billing with invoice generation and GST calculation
- Order management with invoice details and print/download support
- Customer management with walk-in and GST customer support
- Sales, customer, inventory, and GST reporting
- Store settings for identity, billing defaults, and POS behavior

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS, Axios
- Backend: Node.js, Express, MongoDB, Mongoose
- Auth/Security: JWT, bcryptjs, protected routes, role-based access
- Deployment: Vercel, Render, MongoDB Atlas

## Project Structure

```text
BasketIQ/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── tests/
│   ├── utils/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Local Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd BasketIQ
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Backend uses `backend/.env` based on `backend/.env.example`.

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/basketiq
JWT_SECRET=change_this_to_a_secure_secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
ALLOW_ADMIN_SIGNUP=false
SHOP_NAME=BasketIQ Store
SHOP_ADDRESS=Main Road, Mumbai
SHOP_GST_NUMBER=27ABCDE1234F1Z5
SHOP_STATE_CODE=27
```

Frontend uses `frontend/.env` based on `frontend/.env.example`.

```env
VITE_API_URL=http://localhost:5000/api
```

Only example configuration is shown above. Do not commit real secrets or production environment values.

### 3. Run the project

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

## Useful Scripts

Backend:

- `npm run dev` - start the development server
- `npm start` - start the production server
- `npm test` - run backend tests
- `npm run seed:demo` - seed demo retail data

Frontend:

- `npm run dev` - start the Vite development server
- `npm run build` - create a production build
- `npm run lint` - run frontend lint checks
- `npm run preview` - preview the production build locally

## Demo Data

To quickly populate the app with realistic demo data:

```bash
cd backend
npm run seed:demo
```

This resets the main retail collections and loads sample products, customers, orders, stock movement records, and GST-ready billing data.

## Deployment Notes

### Backend on Render

Recommended Render service settings:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Required backend environment variables:

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `ALLOW_ADMIN_SIGNUP`
- `SHOP_NAME`
- `SHOP_ADDRESS`
- `SHOP_GST_NUMBER`
- `SHOP_STATE_CODE`

### Frontend on Vercel

Recommended Vercel settings:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Required frontend environment variable:

- `VITE_API_URL` = your deployed Render backend URL + `/api`

Example:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

## Submission Notes

- `.env` files are intentionally ignored and must not be committed
- Build output and installed dependencies are ignored
- The repository structure is clean and suitable for internship or recruiter review
- The project is presented as a business-focused smart retail platform

## Recommended Final Checks Before Submission

Run these checks before pushing:

```bash
cd backend && npm test
cd ../frontend && npm run lint
cd ../frontend && npm run build
```

## License

This project is prepared for academic, portfolio, and internship submission use.
