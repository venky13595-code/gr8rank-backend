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
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// ==========================================
// ADMIN APIs
// ==========================================

app.get('/api/admin/employees', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT name, mobile_number FROM mar.employees ORDER BY name ASC'
    );
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/admin/attendance', async (req, res) => {
  const { name, fromDate, toDate, limit = 100 } = req.query;
  try {
    let query = 'SELECT * FROM mar.attendance WHERE 1=1';
    const values = [];
    let idx = 1;

    if (name && name !== 'All Employees') {
      query += ` AND name = $${idx++}`;
      values.push(name);
    }
    if (fromDate) {
      query += ` AND log_dttm >= $${idx++}::date`;
      values.push(fromDate);
    }
    if (toDate) {
      query += ` AND log_dttm < $${idx++}::date + INTERVAL '1 day'`;
      values.push(toDate);
    }

    query += ` ORDER BY log_dttm DESC LIMIT $${idx}`;
    values.push(parseInt(limit));

    const result = await pool.query(query, values);
    res.json({ status: "success", data: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// FIXED: Leave filter - matches table columns exactly
app.get('/api/admin/leaves', async (req, res) => {
  const { name, fromDate, toDate, status, limit = 100 } = req.query;
  try {
    let query = 'SELECT * FROM mar.leave_plan WHERE 1=1';
    const values = [];
    let idx = 1;

    if (name && name !== 'All Employees') {
      query += ` AND name = $${idx++}`;
      values.push(name);
    }
    if (fromDate) {
      query += ` AND date_from >= $${idx++}::date`;
      values.push(fromDate);
    }
    if (toDate) {
      query += ` AND date_to <= $${idx++}::date`;
      values.push(toDate);
    }
    if (status && status !== 'All') {
      query += ` AND status = $${idx++}`;
      values.push(status);
    }

    query += ` ORDER BY applied_at DESC LIMIT $${idx}`;
    values.push(parseInt(limit));

    const result = await pool.query(query, values);
    res.json({ status: "success", data: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// FIXED: Update leave status - only updates status column
app.post('/api/admin/leaves/update', async (req, res) => {
  const { id, status } = req.body;
  
  console.log('Received update request:', { id, status }); // Debug log
  
  if (!id || !status) {
    return res.status(400).json({ 
      status: "error", 
      message: "Missing required fields: id and status" 
    });
  }

  try {
    const result = await pool.query(
      'UPDATE mar.leave_plan SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: "error", 
        message: `Leave with id ${id} not found` 
      });
    }

    console.log('Updated successfully:', result.rows[0]); // Debug log
    
    res.json({ 
      status: "success", 
      message: `Leave ${status.toLowerCase()} successfully`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Update error:', err); // Debug log
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Alternative endpoint with different status format (if app sends different values)
app.post('/api/admin/leaves/approve', async (req, res) => {
  const { id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE mar.leave_plan SET status = $1 WHERE id = $2 RETURNING *',
      ['Approved', id]
    );
    res.json({ status: "success", message: "Leave approved", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post('/api/admin/leaves/reject', async (req, res) => {
  const { id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE mar.leave_plan SET status = $1 WHERE id = $2 RETURNING *',
      ['Rejected', id]
    );
    res.json({ status: "success", message: "Leave rejected", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const [attendance, leaves, employees] = await Promise.all([
      pool.query(`
        SELECT COUNT(DISTINCT emp_id) as present_today
        FROM mar.attendance
        WHERE log_dttm >= CURRENT_DATE AND log_dttm < CURRENT_DATE + INTERVAL '1 day'
      `),
      pool.query(`SELECT COUNT(*) as pending_leaves FROM mar.leave_plan WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) as total_employees FROM mar.employees`)
    ]);

    res.json({
      status: "success",
      data: {
        presentToday: parseInt(attendance.rows[0].present_today),
        totalEmployees: parseInt(employees.rows[0].total_employees),
        pendingLeaves: parseInt(leaves.rows[0].pending_leaves)
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ==========================================
// AUTH APIs
// ==========================================

app.get('/api/auth/verify-mobile/:mobile', async (req, res) => {
  const { mobile } = req.params;
  try {
    const adminResult = await pool.query(
      'SELECT * FROM mar.admin WHERE mobile_number = $1 LIMIT 1',
      [mobile]
    );
    if (adminResult.rows.length > 0) {
      return res.json({ status: "success", role: "admin", data: adminResult.rows[0] });
    }

    const empResult = await pool.query(
      'SELECT * FROM mar.employees WHERE mobile_number = $1 LIMIT 1',
      [mobile]
    );
    if (empResult.rows.length > 0) {
      return res.json({ status: "success", role: "employee", data: empResult.rows[0] });
    }

    res.json({ status: "error", message: "Not registered" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ==========================================
// EMPLOYEE APIs
// ==========================================

app.post('/api/attendance', async (req, res) => {
  const { emp_id, name, mobile_number, log_location, log_dttm } = req.body;
  try {
    const check = await pool.query(
      `SELECT id FROM mar.attendance 
       WHERE emp_id = $1 AND log_dttm >= CURRENT_DATE AND log_dttm < CURRENT_DATE + INTERVAL '1 day' 
       LIMIT 1`,
      [emp_id]
    );

    if (check.rows.length > 0) {
      await pool.query(
        'UPDATE mar.attendance SET update_location = $1, up_dttm = CURRENT_TIMESTAMP WHERE id = $2',
        [log_location, check.rows[0].id]
      );
      res.json({ status: "success", message: "Check-out updated", type: "update" });
    } else {
      await pool.query(
        'INSERT INTO mar.attendance (emp_id, name, mobile_number, log_location, log_dttm) VALUES ($1,$2,$3,$4,$5)',
        [emp_id, name, mobile_number, log_location, log_dttm]
      );
      res.json({ status: "success", message: "Check-in marked", type: "checkin" });
    }
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/attendance/:emp_id', async (req, res) => {
  const { emp_id } = req.params;
  const { fromDate, toDate, limit = 30 } = req.query;
  try {
    let query = 'SELECT * FROM mar.attendance WHERE emp_id = $1';
    const values = [emp_id];
    let idx = 2;

    if (fromDate) {
      query += ` AND log_dttm >= $${idx++}::date`;
      values.push(fromDate);
    }
    if (toDate) {
      query += ` AND log_dttm < $${idx++}::date + INTERVAL '1 day'`;
      values.push(toDate);
    }

    query += ` ORDER BY log_dttm DESC LIMIT $${idx}`;
    values.push(parseInt(limit));

    const result = await pool.query(query, values);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// FIXED: Apply leave - only uses existing columns
app.post('/api/leaves', async (req, res) => {
  const { emp_id, name, mobile_number, date_from, date_to, days, leave_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO mar.leave_plan (emp_id, name, mobile_number, date_from, date_to, days, leave_type, status) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [emp_id, name, mobile_number, date_from, date_to, days || 1, leave_type]
    );
    res.json({ 
      status: "success", 
      message: "Leave applied successfully",
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get('/api/leaves/:emp_id', async (req, res) => {
  const { emp_id } = req.params;
  const { limit = 20 } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM mar.leave_plan WHERE emp_id = $1 ORDER BY applied_at DESC LIMIT $2`,
      [emp_id, parseInt(limit)]
    );
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ==========================================
// SERVER START
// ==========================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Database: ${pool.options.database}`);
  console.log(`✅ Endpoints ready:`);
  console.log(`   POST /api/admin/leaves/update`);
  console.log(`   POST /api/admin/leaves/approve`);
  console.log(`   POST /api/admin/leaves/reject`);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

