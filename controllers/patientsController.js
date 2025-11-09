import db from "../libs/database.js";

export const getPatients = async (req, res) => {
    const doctorId = req.query.doctor_id || null;
    const userType = req.query.user_type || "doctor";
    const patientId = req.query.patient_id || null;

    let query = "";
    let params = [];

    try {
        if(patientId) {
            query = `
                SELECT p.*, d.name AS doctor_name, d.email AS doctor_email 
                FROM patients p 
                JOIN doctors d ON p.doctor_id = d.id 
                WHERE p.id = ?`;
            params = [patientId];

            const [rows] = await db.execute(query, params);
            if(rows.length === 0) {
                return res.status(404)
                    .json({
                        error: "Patient not found."
                    })
            }

            return res.status(200)
                .json({
                    success: "true",
                    patient: rows[0]
                });
        }

        if(userType === "doctor" && doctorId) {
            query = `
                SELECT p.*, 
                CASE 
                    WHEN p.video_path IS NOT NULL AND p.report_path IS NOT NULL THEN 'completed'
                    WHEN p.scan_date IS NOT NULL THEN 'scanned' 
                    ELSE 'pending' 
                END AS status
                FROM patients p 
                WHERE p.doctor_id = ? 
                ORDER BY p.created_at DESC`;
            params = [doctorId];

        }
        else {
            query = `
                SELECT p.*, d.name AS doctor_name, d.email AS doctor_email,
                CASE 
                    WHEN p.video_path IS NOT NULL AND p.report_path IS NOT NULL THEN 'completed'
                    WHEN p.scan_date IS NOT NULL THEN 'scanned' 
                    ELSE 'pending' 
                END AS status
                FROM patients p 
                JOIN doctors d ON p.doctor_id = d.id 
                ORDER BY p.created_at DESC`;
            params = [];
        }

        const [rows] = await db.execute(query, params);

        return res.status(200)
            .json({
                success: "true",
                patients: rows
            });
    } catch (error) {
        console.log('Error fetching patients:', error);
        return res.status(500).json({ success: false, error: 'Error while fetching patients' });
    }
}

export const createPatient = async (req, res) => {
    const {
        doctor_id,
        name, contact_number, location, age, chief_complaint, medical_history
    } = req.body;

    if(!doctor_id || doctor_id.length === 0) {
        return res.status(404)
            .json({ error: "Doctor ID is required." });
    }
    if(!name || name.length === 0) {
        return res.status(404)
            .json({ error: "Name is required." });
    }
    if(!contact_number || contact_number.length === 0) {
        return res.status(404)
            .json({ error: "Contact Number is required." });
    }
    if(!location || location.length === 0) {
        return res.status(404)
            .json({ error: "Location is required." });
    }

    try {
        const query = `INSERT INTO patients (doctor_id, name, contact_number, location, age, gender, chief_complaint, medical_history, scan_date, scan_time) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [doctor_id, name, contact_number, location, age, null, chief_complaint, medical_history, null, null];

        const [result] = await db.execute(query, params);
        const patientId = result.insertId;

        return res.status(201)
            .json({
                success: true,
                message: "Patient added successfully.",
                patient_id: patientId
            });

    } catch (error) {
        console.log("Error while creating patient: ", error);
        return res.status(500)
            .json({ error: "Error while creating patients." });
    }
 
}

export const updatePatient = async (req, res) => {
    const data = req.body;
    
    if (!data.patient_id) {
        return res.status(400).json({ success: false, error: 'Patient ID required' });
    }
    
    const fields = [];
    const values = [];
    
    const allowedFields = ['name', 'contact_number', 'location', 'age', 'gender', 'chief_complaint', 'medical_history', 'video_path', 'report_path', 'treatment_confirmed', 'scan_date', 'scan_time'];
    
    for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
            fields.push(`${field} = ?`);
            values.push(data[field]);
        }
    }
    
    if (fields.length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    values.push(data.patient_id);
    
    
    try {
        const query = `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.execute(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Patient not found or no changes made' });
        }
        
        if (data.video_path && data.report_path) {
            await unlockTimeSlot(data.patient_id);
            
            await notifyDoctor(data.patient_id, 'Treatment Report Ready', 'Your patient\'s scan report and video are ready for review.');
        }
        
        return res.status(200).json({ success: true, message: 'Patient updated successfully' });
    } catch (error) {
        console.error('Failed to update patient:', error);
        return res.status(500).json({ success: false, error: 'Failed to update patient' });
    }
}

export const bookTimeSlot = async (date, time, doctorId, patientId) => {
    try {
        const [existingTimeSlot] = await db.execute(
        `SELECT * FROM time_slots WHERE slot_date = ? AND slot_time = ? AND is_booked = TRUE`,
        [date, time]
    );

    if(existingTimeSlot.length > 0) return false;

    const query = `INSERT INTO time_slots (slot_date, slot_time, is_booked, booked_by_doctor, patient_id) 
              VALUES (?, ?, TRUE, ?, ?) 
              ON DUPLICATE KEY UPDATE 
              is_booked = TRUE, booked_by_doctor = ?, patient_id = ?`;
    const params = [date, time, doctorId, patientId, doctorId, patientId];

    const [result] = await db.execute(query, params);

    return true;
    } catch (error) {
        console.log("Error while booking time slot: ", error);
        throw new Error("Time slot booking failed.");
        
    }
}

export const unlockTimeSlot = async (patientId) => {
    try {
        const query = "UPDATE time_slots SET is_booked = FALSE, booked_by_doctor = NULL, patient_id = NULL WHERE patient_id = ?";
        const params = [patientId];

        const [result] = await db.execute(query, params);

        
    } catch (error) {
        console.log("Error while updating time slot: ", error);
        throw new Error("Time slot unlocking failed.");
        
    }
}

export async function notifyDoctor(patientId, title, message) {
    try {
        const query = "SELECT doctor_id FROM patients WHERE id = ?";
        const [rows] = await db.query(query, [patientId]);
        
        if (rows.length === 0) {
            console.log(`Patient ID ${patientId} not found.`);
            return;
        }

        const doctorId = rows[0].doctor_id;

        const insertQuery = "INSERT INTO notifications (user_type, user_id, title, message) VALUES (?, ?, ?, ?)";
        
        await db.execute(insertQuery, ['doctor', doctorId, title, message]);
        
    } catch (error) {
        console.log('Error notifying doctor:', error);
    }
}