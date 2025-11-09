import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';

const options = {
  node: Uint8Array.of(0x01, 0x23, 0x45, 0x67, 0x89, 0xab),
  clockseq: 0x1234,
  msecs: new Date().getTime(),
  nsecs: 5678,
};

const uploadsDir = path.join(process.cwd(), "uploads");

if(!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subDir = path.join(uploadsDir, (file.fieldname === 'photos[]' || file.fieldname === 'photos') ? 'photos' : 'a1_files');
        if(!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

        cb(null, subDir);
    },
    filename: (req, file, cb) => {
        const unqSuffix = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + unqSuffix + ext);
    }
});

const localUploader = multer({ storage }).fields([
    {name: "video", maxCount: 1},
    {name: "report", maxCount: 1},
    {name: "photos", maxCount: 6},
    {name: "photos[]", maxCount: 6}
]);

export default localUploader;
