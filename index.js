const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Neon Postgres Connection Config
const pool = new Pool({
  host: 'ep-shy-darkness-a8sqj8nx-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'Gr8rank',
  user: 'neondb_owner',
  password: 'npg_oWvbYkNpK1e2',
  ssl: {
    rejectUnauthorized: false // Required for Neon
  }
});

// 1. Verify Mobile Endpoint
app.get('/api/auth/verify-mobile/:mobile', async (req, res) => {
  const { mobile } = req.params;
  try {
    const query = 'SELECT * FROM mar.employees WHERE mobile_number = $1';
    const result = await pool.query(query, [mobile]);
    
    if (result.rows.length > 0) {
      res.json({ status: "success", message: "Employee verified", data: result.rows[0] });
    } else {
      res.json({ status: "error", message: "Not our employee" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Database error" });
  }
});

// 2. Mark Attendance
app.post('/api/attendance', async (req, res) => {
  const { emp_id, name, mobile_number, log_location, log_dttm } = req.body;
  try {
    const query = `
      INSERT INTO attendance (emp_id, name, mobile_number, log_location, log_dttm) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const values = [emp_id, name, mobile_number, log_location, log_dttm];
    const result = await pool.query(query, values);
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 3. Apply Leave
app.post('/api/leaves', async (req, res) => {
  const { emp_id, name, mobile_number, date_from, date_to, leave_type } = req.body;
  try {
    const query = `
      INSERT INTO leave_plan (emp_id, name, mobile_number, date_from, date_to, leave_type) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const result = await pool.query(query, [emp_id, name, mobile_number, date_from, date_to, leave_type]);
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
