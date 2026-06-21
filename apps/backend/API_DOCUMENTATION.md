# API Documentation

## Base URL

`http://localhost:3000/api`

## Authentication

Authentication is **optional**. Endpoints accept requests without a token. If you choose to log in, include a JWT in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### Authentication

**POST** `users`
Creates a new user with just a username.

* **Body**

  ```json
  { "username": "alice" }
  ```

* **Response (201)**

  ```json
  {
    "message": "User created successfully",
    "user": { "id": 1, "username": "alice" }
  }
  ```

---

**POST** `session/login`
Passwordless login (optional) that upserts the user and returns a JWT.

* **Body**

  ```json
  { "username": "alice" }
  ```

* **Response (200)**

  ```json
  {
    "token": "<jwt-token>",
    "user": {
      "id": 1,
      "username": "alice"
    }
  }
  ```

---

**GET** `profile`
Fetches the current user’s profile.

* **Response (200)**

  ```json
  {
    "id": 1,
    "username": "johndoe",
    "role": "doctor",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2025-07-09T07:00:00.000Z"
  }
  ```

---

### Patients

**GET** `patients`
List all patients.

**POST** `patients`
Create a new patient.

* **Body**

  ```json
  {
    "english_name": "John Smith",
    "khmer_name": "ចន ស្មីត",
    "date_of_birth": "1990-01-01",
    "sex": "male",
    "phone_number": "+855123456789",
    "address": "Phnom Penh, Cambodia"
  }
  ```

**GET** `patients/{id}`
Fetch a patient by ID.

**PUT** `patients/{id}`
Update a patient’s info.

**DELETE** `patients/{id}`
Delete a patient.

---

### Vitals

**POST** `patients/{id}/vitals`
Add a vitals record to a patient.

* **Body**

  ```json
  {
    "height_cm": 175.0,
    "weight_kg": 70.0,
    "bmi": 22.9,
    "blood_pressure": "120/80",
    "temperature_c": 36.8,
    "vitals_notes": "Patient appears healthy"
  }
  ```

**GET** `patients/{id}/vitals`
List all vitals records for a patient.

---

### HEF

**POST** `patients/{id}/hef`
Add an HEF record.

**GET** `patients/{id}/hef`
List HEF records.

---

### Visual Acuity

**POST** `patients/{id}/visual_acuity`
Add a visual acuity record.

**GET** `patients/{id}/visual_acuity`
List visual acuity records.

---

### Presenting Complaint

**POST** `patients/{id}/presenting_complaint`
Add a presenting complaint.

**GET** `patients/{id}/presenting_complaint`
List presenting complaints.

---

### History

**POST** `patients/{id}/history`
Add a history record.

**GET** `patients/{id}/history`
List history records.

---

### Consultation

**POST** `patients/{id}/consultations`
Create a consultation.

**GET** `patients/{id}/consultations`
List consultations for a patient.

---

### Referral

**POST** `consultations/{id}/referrals`
Add a referral to a consultation.

**GET** `consultations/{id}/referrals`
List referrals for a consultation.

---

### Physiotherapy

**POST** `patients/{id}/physiotherapy`
Add a physiotherapy record.

**GET** `patients/{id}/physiotherapy`
List physiotherapy records.

---

### Combined Registration

**POST** `registration`  
Create a patient and optionally append vitals, HEF, and visit in one request.

**PUT** `registration/{patientId}`  
**Combined update (patient + optional append vitals/HEF/visit)**  
Update patient data and optionally append a vitals record, HEF record, and/or visit in a single call.

**DELETE** `registration/{patientId}`  
Delete a patient (cascades to vitals/HEF/visits).

---

## Error Responses

* **400 Validation Error**

  ```json
  {
    "message": "Validation failed",
    "errors": [ /* field errors */ ]
  }
  ```
* **401 Authentication Error**

  ```json
  {
    "message": "Access token required"
  }
  ```
* **403 Authorization Error**

  ```json
  {
    "message": "Insufficient permissions"
  }
  ```
* **404 Not Found**

  ```json
  {
    "message": "Resource not found"
  }
  ```
* **500 Server Error**

  ```json
  {
    "message": "Internal server error"
  }
  ```

---

## Rate Limiting

100 requests per 15 minutes per IP.
