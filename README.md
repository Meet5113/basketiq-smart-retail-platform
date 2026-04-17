# BasketIQ Smart Retail Platform

BasketIQ is a full-stack smart retail admin platform built for internship-level product, billing, and inventory workflows. It combines POS billing, GST-ready invoices, stock tracking, customer management, reporting, and role-based access in one business-focused dashboard.

The project is organized as a simple two-app setup:

- `frontend/`: React + Vite admin dashboard
- `backend/`: Node.js + Express + MongoDB API

## Core Modules

- Authentication with `admin` and `staff` roles
- Product master management with GST slab configuration
- Inventory tracking with stock movement history and low-stock visibility
- POS billing with invoice generation and GST calculation
- Order management with invoice detail and print/download support
- Customer management with walk-in and GST customer support
- Reports for sales, customers, inventory, and GST
- Settings for store identity, billing defaults, and POS behavior

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS, Axios
- Backend: Node.js, Express, MongoDB, Mongoose
- Auth/Security: JWT, bcryptjs, protected routes, role-based access

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

- `npm run dev` - start development server
- `npm start` - start production server
- `npm test` - run backend tests
- `npm run seed:demo` - seed demo retail data

Frontend:

- `npm run dev` - start Vite dev server
- `npm run build` - create production build
- `npm run lint` - run frontend lint checks
- `npm run preview` - preview built frontend locally

## Demo Data

To quickly populate the app with realistic internship-demo data:

```bash
cd backend
npm run seed:demo
```

This resets the main retail collections and loads products, customers, orders, stock movement data, and GST-ready sample billing records.

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
- The repository is structured for clean GitHub submission without generated junk
- The app is designed to look business-professional and realistic for a retail internship project

## Recommended Final Checks Before Submission

Run these once before pushing:

```bash
cd backend && npm test
cd ../frontend && npm run lint
cd ../frontend && npm run build
```

## License

This project is prepared for academic and internship submission use.
