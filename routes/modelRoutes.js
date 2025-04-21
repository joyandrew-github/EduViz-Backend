const express = require('express');
const { uploadModel, fetchModel, listModels, createModel,fetchModelsByInstructor,getAllModels,getModelById} = require('../controllers/modelController');
const upload = require('../middleware/multerConfig');
const router = express.Router();

router.post('/upload-model', upload.single('model'), uploadModel);
router.get('/model/:id', fetchModel);
router.get('/models', listModels);
router.get('/api/models/instructor/:instructorId', fetchModelsByInstructor);

router.post(
  '/create-model',
  upload.fields([
    { name: 'mainModel', maxCount: 1 },
    { name: 'modelCover', maxCount: 1 }, // Added modelCover field
    { name: 'parts', maxCount: 10 }, // Adjust maxCount as needed
  ]),
  createModel
);
router.get('/api/models/all',getAllModels);
router.get('/api/models/:id', getModelById);
module.exports = router;