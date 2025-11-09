import db from "../libs/database.js";

export async function getAvailableSlots(req, res) {
    const inputDate = req.query.date ? new Date(req.query.date) : new Date();
    const weeks = parseInt(req.query.weeks) || 2;

    const timeSlots = generateTimeSlots();

    inputDate.setHours(0, 0, 0, 0);

    let endDate = new Date(inputDate);
    endDate.setDate(endDate.getDate() + weeks*7);

    const dateRange = getDateRange(inputDate, weeks);
    const dateStrigns = dateRange.map(date => (
        date.toISOString().split('T')[0]
    ));

    try {
        const query = `SELECT slot_date, slot_time FROM time_slots WHERE slot_date IN (?) AND is_booked = TRUE`;
        const [bookedSlots] = await db.execute(query, [dateStrigns]);

        const bookedMap = new Set();
        bookedSlots.forEach(slot => {
            bookedMap.add(`${slot.slot_date.toISOString().split('T')[0]} ${slot.slot_time}`);
        })

        const finalSlots = dateRange.map(date => {
            const day = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

            const slots = timeSlots.map(time => {
                const isBooked = bookedMap.has(`${day} ${time}`);
                return (
                    {
                        time,
                        available: !isBooked,
                        datetime: `${day} ${time}`
                    }
                )
            });

            return (
                {
                    date: day,
                    day: dayName,
                    slots
                }
            )
        });

        return res.status(200)
            .json({
                success: true,
                slots: finalSlots
            });
    } catch (error) {
        console.log("Error fetching available slots: ", error);
        return res.status(500)
            .json({ error: "Error Fetching available slots." });
        
    }

}

export async function bookSlot(req, res) {    
    const { date, time, doctor_id, patient_id } = req.body;

    if(!date || !time || !doctor_id || !patient_id) {
        return res.statue(400)
            .json({ error: "Date, Time, doctor_id and patient_id are required." });
    }

    try {
        const checkQuery = "SELECT id FROM time_slots WHERE slot_date = ? AND slot_time = ? AND is_booked = TRUE";
        const [checkRows] = await db.query(checkQuery, [date, time]);
        
        if (checkRows.length > 0) {
            return res.status(409).json({ error: 'Slot is not available.' });
        }
        
        const query = `INSERT INTO time_slots (slot_date, slot_time, is_booked, booked_by_doctor, patient_id) 
            VALUES (?, ?, TRUE, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            is_booked = TRUE, booked_by_doctor = VALUES(booked_by_doctor), patient_id = VALUES(patient_id)`;
        
        const [bookResult] = await db.execute(query, [date, time, doctor_id, patient_id]);

        const updatePatient = "UPDATE patients SET scan_date = ?, scan_time = ? WHERE id = ?";
        await db.execute(updatePatient, [date, time, patient_id]);

        return res.status(200)
            .json({ success: true, message: 'Slot booked and patient updated successfully' });
    } catch (error) {
        console.error('Failed to book slot:', error);
        return res.status(500).json({ error: 'Failed to book slot or update patient.' });
    }
}

function getDateRange(startDate, weeks) {
    let dateRange = [];
    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + weeks*7);

    let currDate = new Date(startDate);
    while(currDate <= endDate) {
        dateRange.push(new Date(currDate));

        currDate.setDate(currDate.getDate()+1);
    }

    

    return dateRange;
}
function generateTimeSlots() {
    let slots = [];
    const startTime = 9 * 60;
    const endTIme = 21 * 60;

    for(let time = startTime; time < endTIme; time += 30) {
        const hour = Math.floor(time/60);
        const minute = time%60;
        const slot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2,'0')}`;
        slots.push(slot);
    }

    return slots;
}