// npm packages
import multer from 'multer';
import multerS3 from 'multer-s3';
import aws from 'aws-sdk';
import dotenv from 'dotenv';
import { cloudServerUrl, serverAppId, useLocal } from '../../Utils.js';
dotenv.config({ quiet: true });

function sanitizeFileName(fileName) {
  // Remove spaces and invalid characters
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '');
}

function logAwsErr(err) {
  if (!err) return;
  console.log("S3_UPLOAD_ERROR", {
    name: err.name,
    code: err.code,
    statusCode: err.statusCode,
    message: err.message,
    region: err.region,
    time: err.time,
    requestId: err.requestId,
    extendedRequestId: err.extendedRequestId,
    cfId: err.cfId,
    retryable: err.retryable,
    hostname: err.hostname,
  });
}

async function uploadFile(req, res) {
  try {
    //--size extended to 100 mb
    const size = 100 * 1024 * 1024;
    //console.log(size);

    const accepted_extensions = [
      'jpg',
      'png',
      'gif',
      'mp4',
      'mp3',
      'pdf',
      'jpeg',
      'dwg',
      'dxf',
      'zip',
      'rar',
      'txt',
      'doc',
      'docx',
      'pptx',
      'ppt',
      'xlsx',
      'xlsm',
      'xlsb',
      'xltx',
      'xml',
      'xls',
      'xla',
      'xlx',
    ];

    const DO_ENDPOINT = process.env.DO_ENDPOINT;
    const DO_ACCESS_KEY_ID = process.env.DO_ACCESS_KEY_ID;
    const DO_SECRET_ACCESS_KEY = process.env.DO_SECRET_ACCESS_KEY;
    const DO_SPACE = process.env.DO_SPACE;

    const parseBaseUrl = cloudServerUrl; //process.env.SERVER_URL;
    const parseAppId = serverAppId;
    let fileStorage;
    if (useLocal === 'true') {
      fileStorage = multer.diskStorage({
        destination: function (req, file, cb) {
          cb(null, 'files/files');
        },
        metadata: function (req, file, cb) {
          cb(null, { fieldName: 'OPENSIGN_METADATA' });
        },
        filename: function (req, file, cb) {
          let filename = file.originalname;
          let newFileName = filename.split('.')[0];
          let extension = filename.split('.')[1];
          newFileName = sanitizeFileName(
            newFileName + '_' + new Date().toISOString() + '.' + extension
          );
          // console.log(newFileName);
          cb(null, newFileName);
        },
      });
    } else {
      try {
        const spacesEndpoint = new aws.Endpoint(DO_ENDPOINT);
        const s3 = new aws.S3({
          endpoint: spacesEndpoint,
          accessKeyId: DO_ACCESS_KEY_ID,
          secretAccessKey: DO_SECRET_ACCESS_KEY,
          signatureVersion: 'v4',
          region: process.env.DO_REGION,
        });
        fileStorage = multerS3({
          acl: 'public-read',
          s3,
          bucket: DO_SPACE,
          metadata: function (req, file, cb) {
            cb(null, { fieldName: 'OPENSIGN_METADATA' });
          },
          key: function (req, file, cb) {
            //console.log(file);
            let filename = file.originalname;
            let newFileName = filename.split('.')[0];
            let extension = filename.split('.')[1];
            newFileName = sanitizeFileName(
              newFileName + '_' + new Date().toISOString() + '.' + extension
            );
            // console.log(newFileName);
            cb(null, newFileName);
          },
        });
      } catch (err) {
        fileStorage = multer.diskStorage({
          destination: function (req, file, cb) {
            cb(null, 'files/files');
          },
          metadata: function (req, file, cb) {
            cb(null, { fieldName: 'OPENSIGN_METADATA' });
          },
          filename: function (req, file, cb) {
            let filename = file.originalname;
            let newFileName = filename.split('.')[0];
            let extension = filename.split('.')[1];
            newFileName = sanitizeFileName(
              newFileName + '_' + new Date().toISOString() + '.' + extension
            );
            // console.log(newFileName);
            cb(null, newFileName);
          },
        });
      }
    }

    // const s3 = new aws.S3();
    const upload = multer({
      fileFilter: function (req, file, cb) {
        if (accepted_extensions.some(ext => file.originalname.toLowerCase().endsWith('.' + ext))) {
          return cb(null, true);
        }
        // otherwise, return error
        return cb('Only ' + accepted_extensions.join(', ') + ' files are allowed!');
      },
      storage: fileStorage,
      limits: { fileSize: size },
    }).single('file');

    //--call upload function--
   upload(req, res, function (err) {
  if (err) {
    logAwsErr(err); // 👈 THIS is why we added the helper
    return res.status(400).send({
      status: "Error",
      returnCode: 1029,
      message: String(err.message || err),
    });
  }

  const status = 'Success';

  let fileUrl;
  if (useLocal === 'true') {
    fileUrl = `${parseBaseUrl}/files/${parseAppId}/${req.file.filename}`;
  } else {
    fileUrl = req.file.location;
  }

  return res.json({ status, imageUrl: fileUrl });
});

      const status = 'Success';
      //res.header("Access-Control-Allow-Headers", "Content-Type");
      //res.setHeader("Access-Control-Allow-Origin", "*");
      if (useLocal === 'true') {
        // console.log(req.file);
        var fileUrl = `${parseBaseUrl}/files/${parseAppId}/${req.file.filename}`;
      } else {
        var fileUrl = req.file.location;
      }

      return res.json({ status, imageUrl: fileUrl });
    });
  } catch (err) {
    console.log('Exeption in query ' + err.stack);
    const status = 'Error';
    const returnCode = 1021;
    const message = 'Some error occurred';
    return res.send({ status, returnCode, message });
  }
}
export default uploadFile;
