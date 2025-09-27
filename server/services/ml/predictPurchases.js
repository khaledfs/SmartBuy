const Weights = require('../../models/Weights');
const TrainingExample = require('../../models/TrainingExample');

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function predictProbability(X, weights) {
  const z = X.reduce((sum, x_i, i) => sum + x_i * weights[i], 0);
  return sigmoid(z);
}

// Train logistic regression using gradient descent 
function trainLogisticRegression(data, labels, learningRate = 0.01, iterations = 1000) {
  const numSamples = data.length;
  const numFeatures = data[0].length;

  let weights = new Array(numFeatures).fill(0);
  // Gradient descent loop
  for (let k = 0; k < iterations; k++) {
    const gradients = new Array(numFeatures).fill(0);
    // Compute predictions and gradients
    for (let i = 0; i < numSamples; i++) {
      const prediction = predictProbability(data[i], weights);
      const error = prediction - labels[i];

      // Update gradients
      for (let j = 0; j < numFeatures; j++) {
        gradients[j] += error * data[i][j];
      }
    }

    // Update weights
    for (let j = 0; j < numFeatures; j++) {
      weights[j] -= (learningRate / numSamples) * gradients[j];
    }
  }

  return weights;
}

// Train the ML r
async function trainModel() {
  try {
    console.log('Starting ML model training...');
    const examples = await TrainingExample.find().lean();

    if (examples.length === 0) {
      console.log('No training examples found. Using default weights.');
      return await initializeDefaultWeights();
    }

    // Filter out invalid examples
    const validExamples = examples.filter(e => e && e.features && typeof e.label === 'number');

    if (validExamples.length === 0) {
      console.log('No valid training examples found. Using default weights.');
      return await initializeDefaultWeights();
    }

    console.log(`Found ${validExamples.length} valid training examples out of ${examples.length} total`);

    // --- Train/Test Split for Accuracy ---
    // Shuffle examples
    const shuffled = validExamples.sort(() => Math.random() - 0.5);
    const splitIdx = Math.floor(shuffled.length * 0.8); // 80% train, 20% test
    const trainSet = shuffled.slice(0, splitIdx); // 80% train
    const testSet = shuffled.slice(splitIdx); // 20% test

    // Prepare feature matrices and label vectors
    // Features: [bias, isFavorite, addedBefore, recentlyadded, timesAdded, AddedFrequency, timesRejected]
    // Ensure all features are present and default to 0 if missing
    const X_train = trainSet.map(e => {
      // Ensure features object exists and has all required properties
      const features = e.features || {};
      return [
        features.bias || 1,
        features.isFavorite || 0,
        features.addedBefore || 0,
        features.recentlyadded || 0,
        features.timesAdded || 0,
        features.AddedFrequency || 0,
        features.timesRejected || 0,
      ];
    });
    // Labels
    const y_train = trainSet.map(e => e.label || 0);

    const X_test = testSet.map(e => {
      // Ensure features object exists and has all required properties
      const features = e.features || {};
      return [
        features.bias || 1,
        features.isFavorite || 0,
        features.addedBefore || 0,
        features.recentlyadded || 0,
        features.timesAdded || 0,
        features.AddedFrequency || 0,
        features.timesRejected || 0,
      ];
    });
    const y_test = testSet.map(e => e.label || 0);

    // Train the model on the training set
    const trainedWeights = trainLogisticRegression(X_train, y_train);

    let accuracy = null;
    if (X_test.length > 0) {
      let correct = 0;
      for (let i = 0; i < X_test.length; i++) {
        const prob = predictProbability(X_test[i], trainedWeights);
        const pred = prob >= 0.5 ? 1 : 0;
        if (pred === y_test[i]) correct++;
      }
      accuracy = correct / X_test.length;
      console.log(`ML model accuracy on test set: ${(accuracy * 100).toFixed(2)}% (${correct}/${X_test.length})`);
    } else {
      console.log('Not enough data for test set accuracy calculation.');
    }

    const featureNames = [
      'bias',
      'isFavorite',
      'addedBefore',
      'recentlyadded',
      'timesAdded',
      'AddedFrequency',
      'timesRejected'
    ];


    // Update weights in database
    await Promise.all(
      featureNames.map(async (name, i) => {
        await Weights.findOneAndUpdate(
          { featureName: name },
          { weight: trainedWeights[i], updatedAt: new Date() },
          { upsert: true }
        );
      })
    );

    console.log('ML model training completed successfully');
    return trainedWeights;
  } catch (error) {
    console.error('Error training ML model:', error);
    throw error;
  }
}

// Initialize default weights if no training data exists
async function initializeDefaultWeights() {
  const defaultWeights = {
    bias: 0,
    isFavorite: 0.5,
    addedBefore: 0.3,
    timesAdded: 0.4,
    recentlyadded: 0.2,
    timesRejected: -0.3,
    AddedFrequency: 0.1
  };

  await Promise.all(
    Object.entries(defaultWeights).map(async ([name, weight]) => {
      await Weights.findOneAndUpdate(
        { featureName: name },
        { weight, updatedAt: new Date() },
        { upsert: true }
      );
    })
  );

  return Object.values(defaultWeights);
}

async function updateWeights(x, y, learningRate = 0.01) {
  try {
    const weights = await Weights.find().sort({ featureName: 1 }).lean();
    const w = weights.map(wi => wi.weight);
    const featureNames = weights.map(wi => wi.featureName);

    const p = predictProbability(x, w);

    const error = p - y;
    const newW = w.map((wi, i) => wi - learningRate * error * x[i]);
    const now = new Date();

    const updates = featureNames.map((name, i) => ({
      featureName: name,
      weight: newW[i],
      updatedAt: now,
    }));

    await Weights.deleteMany({});
    await Weights.insertMany(updates);

    console.log('Weights updated with new example');
  } catch (error) {
    console.error('Error updating weights:', error);
    throw error;
  }
}
async function rankProducts(productFeatureMap) {
  try {
    const weights = await Weights.find().lean();

    if (weights.length === 0) {
      console.log('No weights found. Using default ranking.');
      return Array.from(productFeatureMap.values()).map(item => ({
        productId: item.productId,
        name: item.name,
        barcode: item.barcode,
        img: item.img,
        type: item.type,
        probability: 0.5
      }));
    }

    const featureNames = weights.map(wi => wi.featureName);
    const w = weights.map(wi => wi.weight);

    const ranked = [];
    for (const [productId, data] of productFeatureMap.entries()) {
      const featureVector = [1]; // bias
      for (const featureName of featureNames.slice(1)) {
        featureVector.push(data[featureName] ?? 0);
      }
      
      const prob = predictProbability(featureVector, w);
      ranked.push({
        productId,
        name: data.name,
        barcode: data.barcode,
        img: data.img,
        type: data.type,
        probability: prob
      });
    }
    ranked.sort((a, b) => b.probability - a.probability);
    return ranked;
  } catch (error) {
    console.error('Error ranking products:', error);
    throw error;
  }
}

// Create training example from user interaction
async function createTrainingExample(userId, productId, features, label, listId = null) {
  try {
    const trainingExample = new TrainingExample({
      userId,
      productId,
      features,
      label,
      context: {
        listId,
        timestamp: new Date()
      }
    });

    await trainingExample.save();
    console.log('Training example created');
    return trainingExample;
  } catch (error) {
    console.error('Error creating training example:', error);
    throw error;
  }
}

module.exports = {
  trainModel,
  rankProducts,
  updateWeights,
  createTrainingExample,
  predictProbability
}; 
