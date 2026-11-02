# 🏛️ CAIPSD Interns & Super Admin Portal (IUB)

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue?style=flat-square&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Google Sheets Sync](https://img.shields.io/badge/Google%20Sheets-Live%20Sync-green?style=flat-square&logo=googlesheets)](https://www.google.com/sheets/about/)
[![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile-orange?style=flat-square)]()

A comprehensive, lightweight Progressive Web Application (PWA) designed for managing interns, daily work report submissions, leave requests, exit gate-passes, and administrative monitoring for the **Center for Artificial Intelligence and Precision Smart Devices (CAIPSD)** at the **Islamia University of Bahawalpur (IUB)**.

---

## 🌟 Key Features

### 👤 1. Intern Portal
- **Self-Service Registration & Login:** Simple authentication and self-registration for new interns.
- **Daily Progress Reporting:** Submit tasks completed, milestones achieved, and blockers encountered.
- **Leave Management:** Submit leave applications with dates, category, and remarks.
- **Exit & Gate Pass Tracking:** Log exit notices and arrival status in real-time.

### 🛡️ 2. Super Admin Dashboard
- **Review & Approvals:** Review, approve, or reject leave requests and exit notices in one click.
- **Live Activity Tracking:** Real-time visibility into who is currently out, who has returned, and daily progress.
- **Intern Roster Management:** Onboard, update, or remove interns from the department roster.
- **Data Export:** Export detailed CSV reports for Daily Reports, Leaves, Outings, and Roster data.

### 📊 3. Google Sheets Live Integration
- **Two-way Cloud Sync:** Real-time sync with Google Spreadsheets via Google Apps Script web app endpoint.
- **Automated Logging:** Automatically preserves historical submissions in cloud spreadsheets for institutional auditing.
- **Built-in Apps Script Generator:** Copy-paste ready Google Apps Script template for rapid deployment.

### 📱 4. Progressive Web App (PWA)
- **Installable:** Install as a standalone native-like app on Android, iOS, Windows, or macOS.
- **Offline & Cache Support:** Powered by a lightweight Service Worker (`sw.js`) for reliable performance.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3 (Modern Flexbox/Grid + CSS Variables), Modern JavaScript (ES6+)
- **Storage & State:** Client-side local storage + Google Sheets REST API / Apps Script backend
- **PWA:** Service Worker (`sw.js`) + Web App Manifest (`manifest.webmanifest`)
- **Typography & Icons:** Plus Jakarta Sans & SVG icons

---

## 🚀 Quick Start / How to Run Locally

Because this is a static Progressive Web App with a Service Worker, it is best run through a local HTTP server:

### Option 1: Python HTTP Server (Recommended)
```bash
# Clone the repository
git clone https://github.com/muhammadalisaim/CAIPSD-PORTAL.git
cd CAIPSD-PORTAL

# Start local server
python3 -m http.server 8080
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Option 2: Node.js (npx serve / live-server)
```bash
npx serve .
# or
npx live-server
```

### Option 3: VS Code Live Server
Right-click on `index.html` and select **"Open with Live Server"**.

---

## ⚙️ Unified Google Spreadsheet Integration

This portal is attached to the central **CAIPSD Google Spreadsheet** that also powers the **CAIPSD Face Attendance System**:

- **Shared Google Spreadsheet:** [View Spreadsheet](https://docs.google.com/spreadsheets/d/1o9Efz9w0-nt6JZABujOIgtmLQgWHxkj4reOVkGpWtqs/edit?usp=sharing)
- **Spreadsheet ID:** `1o9Efz9w0-nt6JZABujOIgtmLQgWHxkj4reOVkGpWtqs`
- **Unified Apps Script Backend:** `google-apps-script.js` (included in this repository)
- **Live Deployed Webhook URL:** `https://script.google.com/macros/s/AKfycbxT6vgdzw0NB7jsp6UnMKNaFK1g5uDOqtZp9NgzlBp9aczDhQ6iNW158AHzx6MHHKu9/exec`

### 📊 Shared Spreadsheet Architecture:
A single Google Spreadsheet seamlessly hosts both systems across distinct sheets/tabs without conflicts:
1. **`Attendance`** &rarr; Real-time AI face attendance check-ins and logs (from CAIPSD Face Attendance).
2. **`Registered Interns`** &rarr; Intern profiles, credentials, department details, and joined dates.
3. **`Daily Reports`** &rarr; Daily intern work tasks, milestones, blockers, and admin reviews.
4. **`Leave Requests`** &rarr; Intern leave applications, categories, dates, and approval statuses.
5. **`Outing Notices`** &rarr; Gate pass records, expected/actual return timestamps, and exit approvals.

### 🚀 How to Deploy the Unified Apps Script Backend:
1. Open the [CAIPSD Google Spreadsheet](https://docs.google.com/spreadsheets/d/1o9Efz9w0-nt6JZABujOIgtmLQgWHxkj4reOVkGpWtqs/edit).
2. In the top menu, go to **Extensions > Apps Script**.
3. Copy the contents of **`google-apps-script.js`** (or click **"📋 Copy Apps Script Code"** in the Super Admin dashboard) and paste it into the Apps Script editor.
4. Click **Deploy > New deployment** (or **Manage deployments > Edit > New version** if updating).
5. Select **Web app** as deployment type:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (essential for web app sync)
6. Click **Deploy** and copy your **Web app URL** (`https://script.google.com/macros/s/.../exec`).
7. Paste this Web app URL into the **Super Admin > Google Spreadsheet Integration** panel and click **Save Configuration**.

---

## 📂 Project Structure

```text
CAIPSD-PORTAL/
├── index.html            # Main Portal application (UI, logic, styles)
├── google-apps-script.js # Unified backend script (Face Attendance + Portal sync)
├── manifest.webmanifest  # PWA web manifest file
├── sw.js                 # Service worker for offline & caching capabilities
├── icon-192.png          # App icon (192x192)
├── icon-512.png          # App icon (512x512)
└── README.md             # Project documentation
```

---

## 👥 Authors & Acknowledgments

- **Center for Artificial Intelligence & Precision Smart Devices (CAIPSD)**
- **The Islamia University of Bahawalpur (IUB)**
- Maintained by [@muhammadalisaim](https://github.com/muhammadalisaim)
