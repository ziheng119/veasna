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
List patients for a location (`location_id` required). Optional `visit_date=YYYY-MM-DD` returns only patients who had a visit on that date. Each patient includes `last_visit_date` (`YYYY-MM-DD`, or `null`): the most recent day they were seen at a screening.

**POST** `patients`
Create a new patient.

* **Body**

  ```json
  {
    "english_name": "John Smith",
    "khmer_name": "ចន ស្មីត",
    "date_of_birth": "1990-01-01",
    "sex": "M",
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

**GET** `patient/{id}`
Fetch a patient plus a lightweight visit list (used by the patient details page).

**PUT** `patient/{id}`
Update a patient’s demographic details (`english_name`, `khmer_name`, `date_of_birth`, `sex`, `phone_number`, `address`). Sets `last_updated_by` and `last_updated_at`.

---

### Queue

**GET** `queue?location_id={id}&date=YYYY-MM-DD`
Today’s active queue for a location (visits with `completed_at` unset).

**Station queues**
Each visit lists the stations it is indicated for (`triage`, `seva`, `physiotherapy`, `consultation`) and moves through them in that order. A visit waits in one station's queue at a time: its first station not yet completed. `POST visits` accepts an optional top-level `stations` array (defaults to every station).

**GET** `queue?location_id={id}&date=YYYY-MM-DD&station={station}`
Visits currently waiting at one station, ordered by when they arrived there. Without `station`, the endpoint returns every active visit as before. Each row includes `current_station` and `stations` (`[{ "station": "triage", "completed": true }, ...]`).

**POST** `queue/{visitId}/stations/{station}/complete`
Finish a station and move the visit to its next indicated station: `{ "next_station": "consultation" }`. Finishing the last station completes the visit (`next_station` is `null`). Returns `409` if the visit is not currently waiting at that station.

**PUT** `queue/{visitId}/stations`
Body `{ "stations": ["seva", "consultation"] }`: the stations the visit still has to go through. Completed stations are kept; pending ones are added or removed to match.

**GET** `queue/next?location_id={id}`
Preview of the next queue number for the location today: `{ "queue_no": "7" }`. Numbers are sequential per location per day, starting at 1. This is a preview only; `POST visits` assigns the actual number when `visit.queue_no` is omitted.

**POST** `queue/{visitId}/complete`
Discharge: remove a visit from every queue regardless of remaining stations. Sets `completed_at` and `last_updated_by` / `last_updated_at`. The visit record is kept. Idempotent if already completed.

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

**POST** `triage/visual-acuity`
Save the Snellen's test for a visit. Body: `visit_id`, `left_with_pinhole`, `left_without_pinhole`, `right_with_pinhole`, `right_without_pinhole`, optional `notes`. Each acuity value is either blank (stored as `null`, reading not taken yet) or a Snellen fraction such as `"6/6"` or `"6/9"`; anything else is rejected with `400`. `POST visits/seva/{visit_id}` applies the same rule to its `*_new` acuity fields.

The triage, Seva, consultation and referral save endpoints accept partially filled forms: only the visit id is required. Blank dates are stored as `null` and missing text as an empty string.

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
