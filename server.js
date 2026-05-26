const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;
const JWT_SECRET = "your-secret-key-change-in-production";

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Database setup
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("Connected to SQLite database");
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

  // Products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        image_url TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
}

// Auth Routes
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res
              .status(400)
              .json({ error: "Username or email already exists" });
          }
          return res.status(500).json({ error: "Database error" });
        }

        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, {
          expiresIn: "24h",
        });
        res.status(201).json({
          message: "User registered successfully",
          token,
          user: { id: this.lastID, username, email },
        });
      },
    );
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "24h" },
      );
      res.json({
        message: "Login successful",
        token,
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });
});

app.get("/api/user", authenticateToken, (req, res) => {
  db.get(
    "SELECT id, username, email, created_at FROM users WHERE id = ?",
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    },
  );
});

// Product Routes
app.get("/api/products", (req, res) => {
  db.all(
    "SELECT * FROM products ORDER BY created_at DESC",
    [],
    (err, products) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      res.json(products);
    },
  );
});

app.get("/api/products/:id", (req, res) => {
  db.get(
    "SELECT * FROM products WHERE id = ?",
    [req.params.id],
    (err, product) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    },
  );
});

app.post(
  "/api/products",
  authenticateToken,
  upload.single("image"),
  (req, res) => {
    const { name, description, price, quantity } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !price || !quantity) {
      return res
        .status(400)
        .json({ error: "Name, price, and quantity are required" });
    }

    db.run(
      "INSERT INTO products (name, description, price, quantity, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        name,
        description,
        parseFloat(price),
        parseInt(quantity),
        image_url,
        req.user.id,
      ],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }
        res.status(201).json({
          message: "Product created successfully",
          product: {
            id: this.lastID,
            name,
            description,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            image_url,
            user_id: req.user.id,
          },
        });
      },
    );
  },
);

app.put(
  "/api/products/:id",
  authenticateToken,
  upload.single("image"),
  (req, res) => {
    const { name, description, price, quantity } = req.body;
    const image_url = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.existing_image;

    db.run(
      "UPDATE products SET name = ?, description = ?, price = ?, quantity = ?, image_url = ? WHERE id = ?",
      [
        name,
        description,
        parseFloat(price),
        parseInt(quantity),
        image_url,
        req.params.id,
      ],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Database error" });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: "Product not found" });
        }
        res.json({ message: "Product updated successfully" });
      },
    );
  },
);

app.delete("/api/products/:id", authenticateToken, (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
