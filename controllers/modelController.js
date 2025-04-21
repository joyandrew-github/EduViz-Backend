const { ObjectId } = require('mongodb');
const { getGfs, getDb } = require('../config/db');
const Model = require('../models/Model');
const User = require('../models/User');

const uploadModel = async (req, res) => {
  const gfs = getGfs();
  if (!gfs) return res.status(503).send('Database not ready');
  try {
    const file = req.file;
    if (!file) return res.status(400).send('No file uploaded');

    const fileName = `${Date.now()}-${file.originalname}`;
    const uploadStream = gfs.openUploadStream(fileName, {
      contentType: file.mimetype,
      metadata: { originalName: file.originalname, size: file.size },
    });

    uploadStream.end(file.buffer);
    uploadStream.on('finish', () => {
      res.json({ fileId: uploadStream.id, message: 'Model uploaded successfully' });
    });
    uploadStream.on('error', (error) => {
      throw error;
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).send('Upload failed');
  }
};
const getModelById = async (req, res) => {
  try {
    const modelId = req.params.id;

    // Validate ObjectId
    if (!ObjectId.isValid(modelId)) {
      return res.status(400).json({ message: 'Invalid model ID' });
    }

    // Fetch model from MongoDB
    const model = await Model.findById(modelId).lean();
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }

    // Prepare response with schema-defined fields only
    const responseModel = {
      id: model._id.toString(),
      title: model.title,
      price: model.price,
      mainModel: model.mainModel,
      modelCover: model.modelCover,
      difficulty: model.difficulty,
      description: model.description,
      category: model.category,
      views: model.views || 0,
      instructorId: model.instructorId.toString(),
      createdAt: model.createdAt,
      learningPoints: model.learningPoints || [],
      keyframes: model.keyframes,
      framesPerSecond: model.framesPerSecond,
      parts: model.parts,
      currency: model.currency,
      isPublished: model.isPublished,
    };

    // Increment views
    await Model.updateOne({ _id: modelId }, { $inc: { views: 1 } });

    res.status(200).json(responseModel);
  } catch (error) {
    console.error('Error fetching model by ID:', error);
    res.status(500).json({ message: 'Error fetching model' });
  }
};
const fetchModel = async (req, res) => {
  const gfs = getGfs();
  console.log('Fetching model ID:', req.params.id);
  if (!gfs) {
    console.log('Database not ready');
    return res.status(503).send('Database not ready');
  }
  try {
    const fileId = new ObjectId(req.params.id);
    const files = await (await getDb()).collection('models.files').findOne({ _id: fileId });
    if (!files) {
      console.log('Model not found:', fileId);
      return res.status(404).send('Model not found');
    }

    console.log('Serving model:', files.filename);
    res.set('Content-Type', files.contentType || 'model/gltf-binary');
    const downloadStream = gfs.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      res.status(500).send('Error streaming model');
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).send('Error fetching model');
  }
};

const listModels = async (req, res) => {
  const gfs = getGfs();
  if (!gfs) return res.status(503).send('Database not ready');
  try {
    const files = await (await getDb()).collection('models.files').find().toArray();
    res.json(
      files.map((file) => ({
        id: file._id.toString(),
        name: file.metadata.originalName,
        size: file.metadata.size,
        uploadDate: file.uploadDate,
      }))
    );
  } catch (error) {
    console.error('List error:', error);
    res.status(500).send('Error listing models');
  }
};

const fetchModelsByInstructor = async (req, res) => {
  const { instructorId } = req.params;
  const gfs = getGfs();
  if (!gfs) return res.status(503).send('Database not ready');

  try {
    const models = await Model.find({ instructorId }).lean();
    if (!models.length) {
      return res.json([]);
    }

    const enrichedModels = await Promise.all(
      models.map(async (model) => {
        return {
          id: model._id.toString(),
          title: model.title,
          description: model.description,
          category: model.category,
          mainModel: model.mainModel,
          modelCover: model.modelCover,
          keyframes: model.keyframes,
          framesPerSecond: model.framesPerSecond,
          price: model.price,
          currency: model.currency,
          difficulty: model.difficulty,
          learningPoints: model.learningPoints,
          parts: model.parts.map((part) => ({
            title: part.title,
            description: part.description,
            uses: part.uses,
            model: part.model,
          })),
          createdAt: model.createdAt,
          instructorId: model.instructorId,
          views: model.views || 0,
          isPublished: model.isPublished || false,
        };
      })
    );

    res.json(enrichedModels);
  } catch (error) {
    console.error('Error fetching models by instructor:', error);
    res.status(500).send('Error fetching models');
  }
};

const getAllModels = async (req, res) => {
  try {
    const models = await Model.find().lean();
    if (!models.length) {
      return res.status(404).json({ message: 'No models found' });
    }
    res.json(models.map((model) => ({ ...model, id: model._id.toString() })));
  } catch (error) {
    console.error('Error fetching all models:', error);
    res.status(500).send('Error fetching models');
  }
};

const createModel = async (req, res) => {
  const gfs = getGfs();
  if (!gfs) {
    console.error('GridFS not initialized');
    return res.status(503).send('Database not ready');
  }

  try {
    const {
      title,
      description,
      category,
      keyframes,
      framesPerSecond,
      instructorId,
      partsData,
      price,
      currency,
      difficulty,
      learningPoints,
    } = req.body;

    console.log('Request body:', req.body);
    console.log('Files received:', req.files);

    const mainModelFile = req.files['mainModel'] ? req.files['mainModel'][0] : null;
    const modelCoverFile = req.files['modelCover'] ? req.files['modelCover'][0] : null;
    const partFiles = req.files['parts'] || [];

    if (!mainModelFile) {
      console.error('Main model file missing');
      return res.status(400).send('Main model file is required');
    }

    // Upload main model file
    const mainModelFileName = `${Date.now()}-${mainModelFile.originalname}`;
    const mainUploadStream = gfs.openUploadStream(mainModelFileName, {
      contentType: mainModelFile.mimetype,
      metadata: { originalName: mainModelFile.originalname, size: mainModelFile.size },
    });
    mainUploadStream.end(mainModelFile.buffer);
    const mainModelId = await new Promise((resolve, reject) => {
      mainUploadStream.on('finish', () => resolve(mainUploadStream.id.toString()));
      mainUploadStream.on('error', (err) => reject(new Error(`Main model upload failed: ${err.message}`)));
    });

    // Upload model cover file (if provided)
    let modelCoverId = null;
    if (modelCoverFile) {
      const modelCoverFileName = `${Date.now()}-${modelCoverFile.originalname}`;
      const coverUploadStream = gfs.openUploadStream(modelCoverFileName, {
        contentType: modelCoverFile.mimetype,
        metadata: { originalName: modelCoverFile.originalname, size: modelCoverFile.size },
      });
      coverUploadStream.end(modelCoverFile.buffer);
      modelCoverId = await new Promise((resolve, reject) => {
        coverUploadStream.on('finish', () => resolve(coverUploadStream.id.toString()));
        coverUploadStream.on('error', (err) => reject(new Error(`Cover upload failed: ${err.message}`)));
      });
    }

    // Process parts
    const partsDataParsed = JSON.parse(partsData || '[]');
    console.log('Parsed parts data:', partsDataParsed);
    const uploadedParts = await Promise.all(
      partsDataParsed.map(async (part, index) => {
        const partFile = partFiles[index];
        if (!partFile) throw new Error(`Missing file for part: ${part.title}`);

        const partFileName = `${Date.now()}-${partFile.originalname}`;
        const partUploadStream = gfs.openUploadStream(partFileName, {
          contentType: partFile.mimetype,
          metadata: { originalName: partFile.originalname, size: partFile.size },
        });
        partUploadStream.end(partFile.buffer);
        const partModelId = await new Promise((resolve, reject) => {
          partUploadStream.on('finish', () => resolve(partUploadStream.id.toString()));
          partUploadStream.on('error', (err) => reject(new Error(`Part upload failed: ${err.message}`)));
        });

        return {
          title: part.title,
          description: part.description,
          uses: part.uses || '',
          model: partModelId,
        };
      })
    );

    // Parse learningPoints
    const learningPointsParsed = JSON.parse(learningPoints || '[]').map((point) =>
      typeof point === 'string' ? point : point.text
    );
    console.log('Parsed learning points:', learningPointsParsed);

    // Create new model
    const newModel = new Model({
      title,
      description,
      category,
      mainModel: mainModelId,
      modelCover: modelCoverId || 'default_cover.jpg',
      keyframes,
      framesPerSecond,
      parts: uploadedParts,
      instructorId,
      price: parseFloat(price) || 0,
      currency: currency || 'INR',
      difficulty: difficulty || 'Advanced',
      learningPoints: learningPointsParsed,
      createdAt: new Date(),
      views: 0,
      isPublished: false,
    });

    console.log('Model to save:', newModel.toObject());
    await newModel.save();
    console.log('Model saved successfully with ID:', newModel._id);

    // Update user's createdCourses
    const updatedUser = await User.updateOne(
      { _id: instructorId, role: 'instructor' },
      { $push: { createdCourses: newModel._id } }
    );
    console.log('User update result:', updatedUser);

    if (updatedUser.matchedCount === 0) {
      console.error('No instructor found with ID:', instructorId);
      return res.status(404).json({ error: 'Instructor not found or not an instructor' });
    }
    if (updatedUser.modifiedCount === 0) {
      console.warn('No changes made to createdCourses for instructor:', instructorId);
    }

    res.status(201).json({
      message: 'Model created successfully',
      modelId: newModel._id.toString(),
      modelCover: modelCoverId || 'default_cover.jpg',
    });
  } catch (error) {
    console.error('Create model error:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      files: req.files,
    });
    res.status(500).json({ error: 'Error creating model', details: error.message });
  }
};

module.exports = { uploadModel, fetchModel, listModels, createModel, fetchModelsByInstructor, getAllModels ,getModelById };