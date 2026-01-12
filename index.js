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

// --- Admin: Get All Employees ---
app.get('/api/admin/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT name, mobile_number FROM mar.employees ORDER BY name ASC');
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// --- Attendance Filter API ---
app.get('/api/admin/attendance', async (req, res) => {
  const { name, fromDate, toDate } = req.query;
  try {
    let query = 'SELECT * FROM attendance WHERE 1=1';
    const values = [];
    let idx = 1;

    if (name && name !== 'All Employees') {
      query += ` AND name = $${idx++}`;
      values.push(name);
    }
    if (fromDate) {
      query += ` AND DATE(log_dttm) >= $${idx++}`;
      values.push(fromDate);
    }
    if (toDate) {
      query += ` AND DATE(log_dttm) <= $${idx++}`;
      values.push(toDate);
    }

    query += ' ORDER BY log_dttm DESC';
    const result = await pool.query(query, values);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// --- Leave Filter API ---
app.get('/api/admin/leaves', async (req, res) => {
  const { name, fromDate, toDate } = req.query;
  try {
    let query = 'SELECT * FROM leave_plan WHERE 1=1';
    const values = [];
    let idx = 1;

    if (name && name !== 'All Employees') {
      query += ` AND name = $${idx++}`;
      values.push(name);
    }
    if (fromDate) {
      query += ` AND date_from >= $${idx++}`;
      values.push(fromDate);
    }
    if (toDate) {
      query += ` AND date_to <= $${idx++}`;
      values.push(toDate);
    }

    query += ' ORDER BY applied_at DESC';
    const result = await pool.query(query, values);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Auth & Other endpoints...
app.get('/api/auth/verify-mobile/:mobile', async (req, res) => {
  const { mobile } = req.params;
  try {
    const adminResult = await pool.query('SELECT * FROM mar.admin WHERE mobile_number = $1', [mobile]);
    if (adminResult.rows.length > 0) return res.json({ status: "success", role: "admin", data: adminResult.rows[0] });
    const empResult = await pool.query('SELECT * FROM mar.employees WHERE mobile_number = $1', [mobile]);
    if (empResult.rows.length > 0) return res.json({ status: "success", role: "employee", data: empResult.rows[0] });
    res.json({ status: "error", message: "Not registered" });
  } catch (err) { res.status(500).json({ status: "error", message: err.message }); }
});

app.post('/api/attendance', async (req, res) => {
  const { emp_id, name, mobile_number, log_location, log_dttm } = req.body;
  try {
    const check = await pool.query('SELECT id FROM attendance WHERE emp_id = $1 AND DATE(log_dttm) = CURRENT_DATE', [emp_id]);
    if (check.rows.length > 0) {
      await pool.query('UPDATE attendance SET update_location = $1, up_dttm = CURRENT_TIMESTAMP WHERE id = $2', [log_location, check.rows[0].id]);
      res.json({ status: "success", message: "Updated" });
    } else {
      await pool.query('INSERT INTO attendance (emp_id, name, mobile_number, log_location, log_dttm) VALUES ($1,$2,$3,$4,$5)', [emp_id, name, mobile_number, log_location, log_dttm]);
      res.json({ status: "success", message: "Marked" });
    }
  } catch (err) { res.status(500).json({ status: "error" }); }
});

app.post('/api/leaves', async (req, res) => {
  const { emp_id, name, mobile_number, date_from, date_to, leave_type } = req.body;
  try {
    await pool.query('INSERT INTO leave_plan (emp_id, name, mobile_number, date_from, date_to, leave_type) VALUES ($1,$2,$3,$4,$5,$6)', [emp_id, name, mobile_number, date_from, date_to, leave_type]);
    res.json({ status: "success" });
  } catch (err) { res.status(500).json({ status: "error" }); }
});

app.post('/api/admin/leaves/update', async (req, res) => {
  const { id, status } = req.body;
  try {
    await pool.query('UPDATE leave_plan SET status = $1 WHERE id = $2', [status, id]);
    res.json({ status: "success" });
  } catch (err) { res.status(500).json({ status: "error" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
