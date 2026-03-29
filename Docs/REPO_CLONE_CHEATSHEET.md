# Repository Clone Cheat Sheet

**Goal:** Clone a repo and push to new GitHub repo in 1 minute

---

## 🚀 AUTOMATED WAY (RECOMMENDED)

### **Step 1: Run the Script**
```bash
# From ANY folder, run:
path\to\clone-repo-script.bat
```

### **Step 2: Answer the Prompts**
- Source folder: `techflow-client-portal`
- New folder: `demo-contractor-portal`
- GitHub username: `robertwilliamhummel-ops`

### **Step 3: Create GitHub Repo When Prompted**
Script will pause and tell you to create the repo on GitHub

### **Step 4: Press Enter**
Script does everything automatically!

**Total Time: 1 minute** ✅

---

## 📋 MANUAL WAY (If Script Fails)

### **Quick Commands (Copy/Paste All)**

```bash
# 1. Go to parent directory
cd ..

# 2. Copy folder
xcopy SOURCE_FOLDER NEW_FOLDER /E /I

# 3. Enter new folder
cd NEW_FOLDER

# 4. Clean up
rmdir /s /q node_modules
rmdir /s /q .git

# 5. Git setup
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME
git push -u origin main
```

**Replace:**
- `SOURCE_FOLDER` = original folder name
- `NEW_FOLDER` = new folder name
- `USERNAME` = your GitHub username
- `REPO_NAME` = new repo name

---

## ⚠️ CRITICAL: Do This FIRST

**Before running ANY commands:**

1. Go to https://github.com/new
2. Create the new repository
3. Repository name = NEW_FOLDER name
4. **DO NOT** check "Initialize with README"
5. Click "Create repository"

**THEN** run the script or commands!

---

## 🎯 Example: Cloning Portal for Demo

### **Using Script:**
```bash
# Run script
clone-repo-script.bat

# Enter:
Source: techflow-client-portal
New: demo-contractor-portal
GitHub User: robertwilliamhummel-ops

# Create repo on GitHub when prompted
# Press Enter
# Done!
```

### **Manual (if needed):**
```bash
cd ..
xcopy techflow-client-portal demo-contractor-portal /E /I
cd demo-contractor-portal
rmdir /s /q node_modules
rmdir /s /q .git
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/robertwilliamhummel-ops/demo-contractor-portal
git push -u origin main
```

---

## 🔧 Common Errors & Fixes

### **Error: "Repository not found"**
**Fix:** You forgot to create the GitHub repo first!
- Go to https://github.com/new
- Create it
- Try push again

### **Error: "remote origin already exists"**
**Fix:** Remove and re-add remote
```bash
git remote remove origin
git remote add origin https://github.com/USERNAME/REPO
git push -u origin main
```

### **Error: "src refspec main does not match any"**
**Fix:** No commits yet
```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

### **Error: Authentication failed**
**Fix:** Use GitHub CLI or Personal Access Token
```bash
gh auth login
```

---

## 📍 Script Location

Save [`clone-repo-script.bat`](clone-repo-script.bat:1) in a convenient location:
- Desktop
- Documents
- Or add to PATH for global access

---

## ⏱️ Time Comparison

| Method | Time | Difficulty |
|--------|------|-----------|
| **Script** | 1 min | Easy ⭐ |
| **Manual (with cheat sheet)** | 2-3 min | Medium ⭐⭐ |
| **Manual (figuring it out)** | 15+ min | Hard ⭐⭐⭐⭐ |

---

## 🎓 What the Script Does

1. ✅ Asks for folder names and GitHub username
2. ✅ Reminds you to create GitHub repo
3. ✅ Copies entire folder
4. ✅ Removes old node_modules and .git
5. ✅ Initializes fresh git repo
6. ✅ Makes initial commit
7. ✅ Adds GitHub remote
8. ✅ Pushes to GitHub
9. ✅ Shows success message

**All automatic. No thinking required!**

---

## 🚀 Next Time You Need to Clone:

1. Double-click `clone-repo-script.bat`
2. Answer 3 questions
3. Create GitHub repo when prompted
4. Done in 60 seconds! ⚡