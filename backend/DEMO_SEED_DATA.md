# Demo Seed Data

Run `npm run seed:demo` from `backend/` to reset the core retail demo collections and repopulate the app with realistic showcase data.

What it creates:

- 11 products across grocery, bakery, dairy, snacks, personal care, home care, electronics, confectionery, beverages, and kitchenware
- GST coverage across `0%`, `5%`, `12%`, `18%`, and `28%`
- 8 customers including walk-in, regular, and GST/business customers
- Opening stock plus manual stock-in, stock-out, and adjustment movements
- 12 POS-driven orders spread across recent days
- Low-stock examples for inventory, dashboard, and notifications
- Report-ready data for sales, products, customers, inventory, GST, and KPI dashboards

Important:

- The script clears these collections before reseeding:
  `products`, `customers`, `orders`, `carts`, `stock_ledgers`, `notifications`, `invoice_counters`, and `system_settings`
- User accounts are not wiped. The script ensures these demo logins exist:
  `demo.admin@basketiq.local / Demo@123`
  `demo.staff@basketiq.local / Demo@123`

Demo highlights after seeding:

- Products with mixed categories and tax slabs
- Orders with `cash`, `upi`, and `card` payments
- Walk-in sales plus regular and GST customer billing
- Intra-state and inter-state GST examples
- Low-stock products ready to show in inventory and notifications
- Recent order history and dashboard trends ready without manual entry
