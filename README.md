# Micropack application portal

This app stores job openings, applications, and chunked résumé documents in Cloud Firestore so approved admins see the same inbox on every device. Applicants may create submissions but cannot read application records or résumé data. Admin access is enforced with Firebase Authentication and Firestore Security Rules.

Gemini runs only after an approved admin opens an application. It extracts job-related evidence from résumés and does not make, recommend, rank, or automate employment decisions.

Before using analysis, open the Firebase console for `stephanos-firebase-site`, select **AI Logic**, click **Get started**, and choose the **Gemini Developer API**. Configure Firebase App Check before production use.

Preview locally from this directory:

```sh
firebase emulators:start --only hosting
```

Connect the directory to a Firebase project, then deploy the database rules and site:

```sh
firebase login
firebase use --add
firebase deploy --only firestore,hosting
```
