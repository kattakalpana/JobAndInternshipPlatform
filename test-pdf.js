const fs = require("fs");
const pdf = require("pdf-parse");
const natural = require("natural");

// Load skills from a predefined skills list
const skillKeywords = [
    "JavaScript", "Python", "Java", "C++", "React", "Node.js",
    "Machine Learning", "Deep Learning", "Data Science",
    "SQL", "MongoDB", "Docker", "Kubernetes", "AWS", "Azure",
    "Cybersecurity", "DevOps", "AI", "NLP", "Computer Vision"
];

const filePath = "C:\Users\Kalpana katta\OneDrive\Documents\practise\public\uploads\sample.pdf.pdf; // Change this to your actual file

const extractSkills = async () => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const text = data.text.toLowerCase();

        // Find matching skills in the text
        const extractedSkills = skillKeywords.filter(skill => text.includes(skill.toLowerCase()));

        console.log("Extracted Skills:", extractedSkills);
    } catch (err) {
        console.error("Error reading PDF:", err);
    }
};

extractSkills();
