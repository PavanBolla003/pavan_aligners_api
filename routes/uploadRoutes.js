import express from "express";
import multer from "multer";
import { deleteFilesLocal, getLocalFileContent, uploadFilesLocal } from "../controllers/uploadsController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import localUploader from "../middlewares/localUploader.js";

const router = express.Router();

router.get("/", (req, res, next) => {
    if (req.query?.action === "get_file") {
        return getLocalFileContent(req, res);
    }

    next();
});

router.use(authMiddleware);

const parseMultipartBody = multer().none();



const routeAction = (req, res, next) => {
    if (req.body.action === 'delete_photo') {
        return deleteFilesLocal(req, res);
    }
    next();
};

router.post('/', localUploader,
    routeAction, 
    uploadFilesLocal 
);

export default router;