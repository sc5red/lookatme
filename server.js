// Import express
const express = require("express");
const path = require("path");

// Initialize app
const app = express();

// Set EJS as the view engine
app.set("view engine", "ejs");

// Set views folder
app.set("views", path.join(__dirname, "views"));

// Middleware (optional)
app.use(express.urlencoded({ extended: true })); // for form submissions
app.use(express.json());

// Example route
app.get("/", (req, res) => {
  res.render("index", { title: "Home Page", message: "Hello from EJS!" });
});

// Set port
const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
