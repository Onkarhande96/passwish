# 🌐 PassWish — क्लाउड व लोकल डिप्लॉयमेंट संपूर्ण मार्गदर्शिका
### (Render, Free Lifetime PostgreSQL & Local Network Deployment Guide)

---

## 📌 १. Render वर मोफत होस्टिंग Lifetime राहील का? (Render Free Tier Analysis)

**थोडक्यात उत्तर:** होय! Render चा Web Service प्लॅन **Lifetime मोफत (100% Free)** आहे. परंतु डेटा सुरक्षित राहण्यासाठी एक महत्त्वाची तांत्रिक बाब समजून घेणे आवश्यक आहे:

### ⚠️ Render Free प्लॅनची मर्यादा आणि त्यावर उपाय:

1. **१५ मिनिटांनंतर स्लीप मोड (Inactivity Spin-down):**
   * **समस्या:** १५ मिनिटे कोणीही ॲप वापरली नाही, तर Render चा सर्व्हर स्लीप मोडमध्ये जातो. त्यानंतर नवीन युझरने साईट उघडल्यावर सुरू व्हायला ३० ते ५० सेकंद (Cold Start) वेळ लागतो. एकदा सुरू झाल्यावर ॲप एकदम जलद चालते.
   * **उपाय (Keep-Alive):** [UptimeRobot.com](https://uptimerobot.com) किंवा [cron-job.org](https://cron-job.org) या मोफत सेवेवर तुमच्या Render ॲपची URL (उदा. `https://passwish-crm.onrender.com/login`) टाका आणि दर १० मिनिटांनी मॉनिटरिंग सेट करा. यामुळे तुमची ॲप **२४ तास, ७ दिवस सतत जागी (Always-On)** राहील!

2. **Ephemeral Disk (स्थानिक फाईल्स नष्ट होणे - अत्यंत महत्त्वाचे!):**
   * **समस्या:** Render च्या मोफत सर्व्हरची स्वतःची हार्ड डिस्क तात्पुरती (Ephemeral) असते. जर आपण फक्त लोकल SQLite (`passport_crm.db`) फाईल वापरली, तर प्रत्येक वेळी Render रिस्टार्ट किंवा री-डिप्लॉय झाल्यावर जुना डेटा पुसला जाऊन सुरुवातीची रिकामी फाईल येईल!
   * **कायमस्वरूपी १००% मोफत उपाय:** **Supabase** किंवा **Neon.tech** चा मोफत क्लाउड डेटाबेस वापरणे!

---

## 🚀 २. सर्वोत्तम Lifetime मोफत पद्धत: Render + Free Supabase Database

या पद्धतीमध्ये **वेब ॲप Render वर चालेल** आणि **डेटाबेस Supabase वर आयुष्यभर मोफत व सुरक्षित राहील**.

```mermaid
flowchart LR
    A["Browser (Laptop / Phone)<br/>No Downloads Needed"] --> B["Render.com<br/>(Free Web App)"]
    B --> C["Supabase / Neon<br/>(Free Lifetime Cloud PostgreSQL)"]
```

### पायरी १: मोफत Supabase डेटाबेस तयार करणे (फक्त २ मिनिटे)
1. [supabase.com](https://supabase.com) वर जाऊन मोफत साइन-अप (Sign up with GitHub or Google) करा.
2. **'New project'** बटणावर क्लिक करा.
3. प्रोजेक्टचे नाव द्या (उदा. `passwish-db`), एक चांगला पासवर्ड सेट करा आणि रिजन (उदा. `Singapore (ap-southeast-1)` किंवा `Mumbai (ap-south-1)`) निवडून **'Create new project'** दाबा.
4. डाव्या मेनूमध्ये खाली **'Project Settings' (गिअर आयकॉन)** -> **'Database'** वर जा.
5. खाली स्क्रोल करून **'Connection String'** मध्ये **'URI'** निवडा.
6. ती लिंक कॉपी करा. ती अशी दिसेल:
   ```text
   postgresql://postgres.[YOUR-PROJECT-ID]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
   *(टीप: `[YOUR-PASSWORD]` च्या जागी तुम्ही सेट केलेला पासवर्ड टाका).*

---

### पायरी २: Render वर वेब ॲप मोफत सुरू करणे
1. [render.com](https://render.com) वर मोफत अकाउंट उघडा.
2. **'New +'** बटणावर क्लिक करून **'Web Service'** निवडा.
3. तुमचे PassWish GitHub Repository जोडा (किंवा पब्लिक रिपो लिंक टाका).
4. Render खालीलप्रमाणे सेटिंग्स विचारेल:
   * **Name:** `passwish-crm`
   * **Language / Environment:** `Python`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `gunicorn app:app --workers 2 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT`
   * **Instance Type:** `Free`
5. खाली **'Advanced'** -> **'Add Environment Variable'** वर क्लिक करा:
   * **Key:** `DATABASE_URL`
   * **Value:** *(पायरी १ मध्ये कॉपी केलेली Supabase ची URI पेस्ट करा)*
   * **Key:** `WEB_MODE`
   * **Value:** `true`
   * **Key:** `SECRET_KEY`
   * **Value:** `passwish-super-secure-session-key-2026`
6. **'Create Web Service'** वर क्लिक करा!

२-३ मिनिटांत तुमची वेब ॲप्लिकेशन लाईव्ह होईल (उदा. `https://passwish-crm.onrender.com`).

---

## 👥 ३. मल्टि-युझर सुरक्षा आणि सत्रांचे व्यवस्थापन (Multi-User & Multi-Session Architecture)

PassWish मध्ये वापरकर्त्याने मागितल्यानुसार **पूर्णपणे स्वतंत्र आणि सुरक्षित मल्टि-युझर व्यवस्था** तयार करण्यात आली आहे:

### ३.१. ॲडमिनद्वारे नवीन युझर निर्मिती:
1. सुपर ॲडमिन (`admin` / `admin123`) लॉगिन करेल.
2. नेव्हिगेशन बारमध्ये फक्त ॲडमिनला **'Users & Staff'** हा स्वतंत्र टॅब दिसेल.
3. **'+ Add New User'** वर क्लिक करून ॲडमिन कोणत्याही स्टाफ/कन्सल्टंटसाठी नवीन युझरनेम, पासवर्ड, नाव, फोन आणि रोल (`Staff` किंवा `Administrator`) तयार करू शकतो.
4. एखादा कर्मचारी नोकरी सोडून गेल्यास ॲडमिन त्याला एका क्लिकवर **'Deactivate'** करू शकतो, ज्यामुळे तो तात्काळ लॉगआउट होईल.

### ३.२. स्वतंत्र ब्राऊझर सत्रे (Zero Session Interference):
* प्रत्येक युझरचे लॉगिन सत्र (Session) त्याच्या स्वतःच्या ब्राऊझर कुकीमध्ये एनक्रिप्टेड पद्धतीने साठवले जाते (`HTTPOnly, SameSite=Lax`).
* कर्मचारी १ (Chrome वरून) आणि कर्मचारी २ (Edge वरून किंवा स्वतःच्या मोबाईलवरून) एकाच वेळी लॉगिन असले, तरी त्यांचे सेशन एकमेकांत मिसळत नाहीत.
* प्रत्येक युझरने ग्राहकांना पाठवलेले मेसेज आणि ॲड केलेले रेकॉर्ड्स `created_by_user_id` आणि `sent_by_user_id` द्वारे ट्रॅक होतात.

### ३.३. ग्राहकाकडून शून्य डाऊनलोड (Zero Client Dependencies):
* कर्मचाऱ्यांना किंवा ग्राहकांना त्यांच्या कॉम्प्युटर/मोबाईलवर Python, Git किंवा कोणतेही सॉफ्टवेअर डाऊनलोड करावे लागत नाही!
* थेट कोणत्याही ब्राऊझरमध्ये URL उघडून काम करता येते.
* व्हॉट्सअॅप मेसेज पाठवण्यासाठी **'Instant Web WhatsApp Queue'** सुविधा दिलेली आहे, जी थेट ब्राऊझरमधून व्हॉट्सअॅप वेब किंवा मोबाईल ॲपवर रिडायरेक्ट करून आपोआप मेसेज भरून देते!

---

## 🏠 ४. पर्याय ३: दुकानात / स्थानिक नेटवर्कवर (LAN) चालवणे (Zero Cloud Cost)

जर तुम्हाला क्लाउडवर जायचे नसेल आणि सर्व डेटा दुकानातील कॉम्प्युटरवरच ठेवायचा असेल:

1. दुकानातील मुख्य कम्प्युटरवर `Start_PassWish.bat` वर डबल-क्लिक करा.
2. ॲप आपोआप `http://127.0.0.1:5000` वर सुरू होईल.
3. मुख्य कम्प्युटरचा स्थानिक IP शोधा (PowerShell मध्ये `ipconfig` टाईप करा, उदा. `192.168.1.15`).
4. आता दुकानातील वायफायशी जोडलेल्या कोणत्याही इतर लॅपटॉप किंवा मोबाईलवरून ब्राऊझरमध्ये उघडा:
   ```text
   http://192.168.1.15:5000
   ```
5. सर्व कर्मचारी एकाच वेळी आपापल्या युझरनेम-पासवर्डने लॉगिन करून काम करू शकतील आणि संपूर्ण डेटा मुख्य कम्प्युटरवरील `passport_crm.db` (SQLite) मध्ये १००% स्थानिक आणि गोपनीय राहील!

---

## 🔑 ५. डिफॉल्ट लॉगिन क्रेडेंशियल्स (Initial Credentials)

* **URL:** `http://127.0.0.1:5000` (किंवा तुमची Render URL)
* **Master Admin Username:** `admin`
* **Default Password:** `admin123`
* *(लॉगिन झाल्यावर त्वरित 'Profile & Shop' मध्ये जाऊन पासवर्ड बदलून घ्या).*
