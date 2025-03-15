
const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORT = 4000;

// PostgreSQL Database Connection
const pool = new Pool({
    user: "postgres",
    host: "",
    database: "",
    password: "", // Replace with your actual password
    port: ,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({ origin: "http://localhost:4000", credentials: true }));
app.use(express.static("public"));

// Ensure "uploads" directory exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Session Middleware
app.use(
    session({
        secret: "mysecret",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }
    })
);

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Serve Static Pages
const protectedRoutes = ["/user-selection", "/profile", "/recruiter"];
protectedRoutes.forEach(route => {
    app.get(route, (req, res) => {
        if (!req.session.userId && !req.session.recruiterId) return res.redirect("/");
        res.sendFile(path.join(__dirname, "public", `${route.slice(1)}.html`));
    });
});

// Check User Session
app.get("/check-session", (req, res) => {
    res.json({ loggedIn: req.session.userId ? true : false });
});

//Route to fetch candidate from users table
app.get("/users", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email FROM users");
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching candidates:", error);
        res.status(500).send("Error retrieving candidate data.");
    }
});

// Signup Route
app.post("/signup", async (req, res) => {
    const { name, email, password, repassword } = req.body;
    if (password !== repassword) return res.status(400).json({ error: "Passwords do not match!" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id",
            [name, email, hashedPassword]
        );
        req.session.userId = result.rows[0].id;
        res.json({ success: true });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ error: "Error signing up!" });
    }
});

// Login Route
app.post("/login", async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "User not found!" });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid password!" });

        if (role === "recruiter") {
            req.session.recruiterId = user.id;
        } else {
            req.session.userId = user.id;
        }

        res.json({ success: true, role });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Error logging in!" });
    }
});

// Profile Submission Route
app.post("/profile", upload.single("resume"), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, skills, jobPreference } = req.body;
    if (!name || !skills || !jobPreference || !req.file) {
        console.error("Error: Missing fields or resume not uploaded");
        return res.status(400).json({ error: "Missing required fields or resume." });
    }

    const resumePath = req.file.path;
    console.log("Uploaded Resume Path:", resumePath);

    try {
        // Insert into DB
        await pool.query(
            "INSERT INTO user_profiles (name, skills, job_preference, resume_path) VALUES ($1, $2, $3, $4)",
            [name, skills, jobPreference, resumePath]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Database Insert Error:", err);
        res.status(500).json({ error: "Error processing resume!" });
    }
});

//Recruiter path
app.post("/post-job", async (req, res) => {
    const { title, required_skills, description } = req.body;

    try {
        const result = await pool.query(
            "INSERT INTO jobs (title, required_skills, description) VALUES ($1, $2, $3) RETURNING *",
            [title, required_skills, description]
        );
        res.status(201).json({ message: "Job posted successfully", job: result.rows[0] });
    } catch (error) {
        console.error("Error posting job:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});


// Job Matching Function
async function findMatchingJobs(userSkills) {
    try {
        const jobs = await pool.query("SELECT * FROM jobs");
        return jobs.rows.filter(job => {
            const requiredSkills = job.required_skills.split(",").map(s => s.trim().toLowerCase());
            return userSkills.some(userSkill => requiredSkills.includes(userSkill.toLowerCase()));
        });
    } catch (err) {
        console.error("Error in job matching:", err);
        return [];
    }
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

