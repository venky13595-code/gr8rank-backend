const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  host: 'ep-shy-darkness-a8sqj8nx-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'Gr8rank',
  user: 'neondb_owner',
  password: 'npg_oWvbYkNpK1e2',
  ssl: { rejectUnauthorized: false }
});

// --- Attendance ---
app.post('/api/attendance', async (req, res) => {
  const { emp_id, name, mobile_number, log_location, log_dttm } = req.body;
  try {
    const checkQuery = 'SELECT id FROM attendance WHERE emp_id = $1 AND DATE(log_dttm) = CURRENT_DATE LIMIT 1';
    const checkResult = await pool.query(checkQuery, [emp_id]);

    if (checkResult.rows.length > 0) {
      const updateQuery = 'UPDATE attendance SET update_location = $1, up_dttm = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
      const updateResult = await pool.query(updateQuery, [log_location, checkResult.rows[0].id]);
      res.json({ status: "success", message: "Attendance Updated", data: updateResult.rows[0] });
    } else {
      const insertQuery = 'INSERT INTO attendance (emp_id, name, mobile_number, log_location, log_dttm) VALUES ($1, $2, $3, $4, $5) RETURNING *';
      const insertResult = await pool.query(insertQuery, [emp_id, name, mobile_number, log_location, log_dttm]);
      res.json({ status: "success", message: "Attendance Marked", data: insertResult.rows[0] });
    }
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// --- Leaves ---
app.post('/api/leaves', async (req, res) => {
  const { emp_id, name, mobile_number, date_from, date_to, leave_type } = req.body;
  try {
    const query = 'INSERT INTO leave_plan (emp_id, name, mobile_number, date_from, date_to, leave_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
    const result = await pool.query(query, [emp_id, name, mobile_number, date_from, date_to, leave_type]);
    res.json({ status: "success", message: "Leave Requested", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/leaves/:emp_id', async (req, res) => {
  const { emp_id } = req.params;
  try {
    const query = 'SELECT * FROM leave_plan WHERE emp_id = $1 ORDER BY applied_at DESC';
    const result = await pool.query(query, [emp_id]);
    res.json({ status: "success", message: "Leaves fetched", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// --- Auth ---
app.get('/api/auth/verify-mobile/:mobile', async (req, res) => {
  const { mobile } = req.params;
  try {
    const result = await pool.query('SELECT * FROM mar.employees WHERE mobile_number = $1', [mobile]);
    if (result.rows.length > 0) {
      res.json({ status: "success", message: "Employee found", data: result.rows[0] });
    } else {
      res.json({ status: "error", message: "Not our employee" });
    }
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
