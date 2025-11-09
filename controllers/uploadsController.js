import db from "../libs/database.js";
import localUploader from "../middlewares/localUploader.js";
import { notifyDoctor, unlockTimeSlot } from "./patientsController.js";
import fs from "fs/promises";


export const uploadFilesLocal = async (req, res) => {
    // localUploader(req, res, async (error) => {
    //     if (error) {
    //         console.error("Multer Error: ", error);
    //         return res.status(400)
    //             .json({
    //                 success: false,
    //                 error: "File upload processing failed."
    //             });
    //     }

    const patientId = Array.isArray(req.body.patient_id) ? req.body.patient_id[0] : req.body.patient_id;
    const uploadType = Array.isArray(req.body.upload_type) ? req.body.upload_type[0] : req.body.upload_type;
    const uploadedFiles = req.files;
    console.log("Patient ID: ", patientId);
    console.log("Upload Type: ", uploadType);
    console.log("Uploaded Files: ", uploadedFiles);


    if (!patientId) {
        return res.status(400)
            .json({ success: false, error: "Patient ID is required." });
    }

    let updates = {};
    let updateFields = [], updateValues = [];

    try {
        if (uploadType === "a1" && uploadedFiles) {
            if (uploadedFiles.video && uploadedFiles.video.length > 0) {
                const videoPath = uploadedFiles.video[0].path;
                updates.video_path = videoPath;
                updateFields.push("video_path = ?");
                updateValues.push(videoPath);
            }
            if (uploadedFiles.report && uploadedFiles.report.length > 0) {
                const reportPath = uploadedFiles.report[0].path;
                updates.report_path = reportPath;
                updateFields.push("report_path = ?");
                updateValues.push(reportPath);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ success: false, error: "A1 upload type requires video or report file." });
            }
        }

        if (uploadType === "doctor" && uploadedFiles['photos[]'] || uploadedFiles?.photos) {
            const photosFromBracket = uploadedFiles['photos[]'] || [];
            const photosFromPlain = uploadedFiles.photos || [];

            const photoFiles = [...photosFromBracket, ...photosFromPlain];
            const photoPaths = photoFiles.map(photo => photo.path);

            const [existingRows] = await db.execute(
                `SELECT photo_path1, photo_path2, photo_path3, photo_path4, photo_path5, photo_path6 FROM patients WHERE id = ?`,
                [patientId]
            );

            if (!existingRows[0]) {
                return res.status(404)
                    .json({
                        success: false,
                        error: "Patient not found for update."
                    });
            }

            const patient = existingRows[0];

            for (const path of photoPaths) {
                let filled = false;

                for (let i = 1; i <= 6; i += 1) {
                    const slotName = `photo_path${i}`;

                    if (!patient[slotName] || patient[slotName] === '') {
                        updateFields.push(`${slotName} = ?`);
                        updateValues.push(path);
                        patient[slotName] = path;
                        filled = true;
                        break;
                    }
                }

                if (!filled) {
                    updateFields.push("photo_path1 = ?");
                    updateValues.push(path);
                }
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: "No files or valid upload action received." });
        }

        const finalUpdateQuery = `UPDATE patients SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`;
        updateValues.push(patientId);

        await db.execute(finalUpdateQuery, updateValues);

        if (uploadType === "a1") {
            const query = "SELECT video_path, report_path, doctor_id, name FROM patients WHERE id = ?";

            const [rows] = await db.execute(query, [patientId]);

            const patient = rows[0];

            if (patient) {
                const check = !!patient.video_path && !!patient.report_path;

                if (check) {
                    await db.execute("UPDATE patients SET status = 'completed' WHERE id = ?", [patientId]);

                    await unlockTimeSlot(patientId);
                    await notifyDoctor(patientId, "Treatment Files Ready", `Scan video and treatment report for patient '${patient.name}' are ready for review.`);

                    return res.status(200)
                        .json({
                            success: true,
                            message: "Files uploaded successfully. Patient status updated to completed and doctor notified.",
                            patient_status: "completed"
                        });
                } else {
                    return res.status(200)
                        .json({
                            success: true,
                            message: "Files uploaded successfully! Waiting for remaining files."
                        });
                }
            }
        }

        return res.status(200)
            .json({
                success: true,
                message: "Files uploaded successfully."
            });
    } catch (error) {
        console.error("Error while uploading files: ", error);
        return res.status(500)
            .json({ success: false, error: "Error while uploading files." });

    }
    // });
}

export const deleteFilesLocal = async (req, res) => {
    const { patient_id, photo_path } = req.body;

    if (!patient_id || !photo_path) {
        return res.status(400)
            .json({
                success: false,
                error: "Patient ID and Photo Path are required."
            });
    }

    try {
        const [patientRows] = await db.execute(
            `SELECT photo_path1, photo_path2, photo_path3, photo_path4, photo_path5, photo_path6 FROM patients WHERE id = ?`,
            [patient_id]
        );

        if (!patientRows[0]) {
            return res.status(404)
                .json({
                    success: false,
                    error: "Patient not found."
                });
        }

        const patient = patientRows[0];
        let toDelete = null;

        for (let i = 1; i <= 6; i++) {
            const slotName = `photo_path${i}`;
            if (patient[slotName] && patient[slotName].trim() === photo_path.trim()) {
                toDelete = slotName;
                break;
            }
        }

        if (!toDelete) {
            return res.status(404)
                .json({
                    success: false,
                    error: `Photo path not associated with patient.`
                });
        }

        const filePath = photo_path.trim();

        try {
            await fs.unlink(filePath);
            console.log("File Deleted Successfully from disk: ", filePath);

        } catch (error) {
            console.log("Error deleting file from disk: ", error);;

        }

        await db.execute(
            `UPDATE patients SET ${toDelete} = NULL, updated_at = NOW() WHERE id = ?`,
            [patient_id]
        );

        return res.status(200)
            .json({
                success: true,
                message: "Photo deleted successfully.",
                deleted_slot: toDelete
            });
    } catch (error) {
        console.log("Error deleting photo: ", error);
        return res.status(500)
            .json({ error: "Error deleting the photo." });
    }
}

export const getLocalFileContent = async (req, res) => {
    const { file_path } = req.query;

    if (!file_path) {
        return res.status(400)
            .json({
                success: false,
                error: "File path is required."
            });
    }

    const PUBLIC_DIR_NAME = "uploads";

    try {
        const publicPathIndex = file_path.indexOf(PUBLIC_DIR_NAME);

        if (publicPathIndex === -1) {
            return res.status(400)
                .json({
                    success: false,
                    error: "Invalid file path."
                });
        }

        const relativeFilePath = file_path.substring(publicPathIndex);

        return res.redirect(302, `/${relativeFilePath}`);
    } catch (error) {
        console.log("Error retrieving file: ", error);
        return res.status(500)
            .json({ error: "Error retrieving the file." });

    }
}