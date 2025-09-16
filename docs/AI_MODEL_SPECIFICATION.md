# AI Model Specification: Intent Classification for Test Automation

## 🎯 AI-Specific Intent

This project centers on training and deploying a **Natural Language Understanding (NLU) model** that converts human language test descriptions into structured, executable test plans. The core AI component is an **intent classification system** that understands user intent from natural language prompts.

## 🧠 Machine Learning Model Architecture

### **Model Type**: Multi-class Text Classification Pipeline
- **Feature Extraction**: TF-IDF Vectorization with n-gram analysis
- **Classifier**: Linear Support Vector Machine (LinearSVC)
- **Pipeline**: sklearn.pipeline.Pipeline for end-to-end processing

### **Technical Specifications**

#### **1. Feature Engineering**
```python
TfidfVectorizer(
    ngram_range=(1,2),      # Unigrams and bigrams
    min_df=1,               # Minimum document frequency
    analyzer='word',        # Word-level analysis
    lowercase=True          # Case normalization
)
```

#### **2. Classification Algorithm**
```python
LinearSVC(
    dual='warn',            # Dual formulation (auto-selected)
    C=1.0,                  # Regularization parameter
    multi_class='ovr',      # One-vs-Rest strategy
    max_iter=1000           # Maximum iterations
)
```

#### **3. Intent Categories**
- **LOGIN**: Authentication-related test flows
- **OPEN**: Navigation and URL opening actions  
- **VERIFY_TITLE**: Page validation operations
- **UNKNOWN**: Fallback for unrecognized intents

## 📊 Training Data & Performance

### **Dataset Composition**
```
Total Samples: 13
- LOGIN: 4 samples (30.8%)
- OPEN: 4 samples (30.8%) 
- VERIFY_TITLE: 3 samples (23.1%)
- UNKNOWN: 2 samples (15.4%)
```

### **Model Performance Metrics**
```
              precision    recall  f1-score   support
       LOGIN       1.00      1.00      1.00         4
        OPEN       1.00      1.00      1.00         4
     UNKNOWN       1.00      1.00      1.00         2
VERIFY_TITLE       1.00      1.00      1.00         3

    accuracy                           1.00        13
   macro avg       1.00      1.00      1.00        13
weighted avg       1.00      1.00      1.00        13
```

**Current Status**: 100% accuracy on training set (baseline established)

## 🔄 AI Model Training Pipeline

### **1. Data Preparation**
```python
# Minimal seed dataset with balanced representation
DATA = [
    ("login", "LOGIN"),
    ("log in to the application", "LOGIN"),
    # ... expanded training examples
]
```

### **2. Feature Extraction**
- **Tokenization**: Word-level splitting with normalization
- **N-gram Analysis**: Captures phrase patterns (1-2 grams)
- **TF-IDF Weighting**: Term frequency × inverse document frequency

### **3. Model Training**
```python
model = Pipeline(steps=[
    ("tfidf", TfidfVectorizer(ngram_range=(1,2), min_df=1)),
    ("clf", LinearSVC()),
])
model.fit(X, y)
```

### **4. Model Persistence**
- **Format**: Joblib serialization
- **Location**: `models/intent_model.joblib`
- **Size**: Lightweight (~50KB)

## 🏗️ AI Integration Architecture

### **Model Deployment**
```python
class IntentModel:
    def __init__(self, path: str | None = None):
        p = pathlib.Path(path or "models/intent_model.joblib")
        self.pipe = load(p)  # Load trained model

    def predict_intent(self, text: str) -> Intent:
        label = self.pipe.predict([text])[0]
        return label
```

### **AI Service Integration**
```python
class LocalPlanner:
    def __init__(self) -> None:
        self.im = IntentModel()  # Load AI model

    def make_plan(self, prompt: str) -> List[PlanItem]:
        intent = self.im.predict_intent(prompt)  # AI prediction
        # Convert intent to executable actions
```

## 🎯 AI-Specific Contributions

### **1. Natural Language Understanding**
- Converts human language to structured intent categories
- Handles variations in phrasing and terminology
- Extensible to new intent types through retraining

### **2. Intelligent Test Generation**
- AI-driven mapping from intent to test actions
- Context-aware parameter extraction (URLs, selectors)
- Fallback to rule-based system for unknown intents

### **3. Model Evolution Capability**
- Retrainable with expanded datasets
- Performance monitoring and evaluation metrics
- Continuous improvement through data collection

## 🚀 AI Enhancement Roadmap

### **Phase 1: Current (Completed)**
- ✅ Basic intent classification (4 categories)
- ✅ TF-IDF + SVM pipeline
- ✅ Model persistence and deployment

### **Phase 2: Planned Enhancements**
- 🔄 Expanded training dataset (100+ samples)
- 🔄 Cross-validation and performance evaluation
- 🔄 Parameter extraction using Named Entity Recognition
- 🔄 Intent confidence scoring

### **Phase 3: Advanced AI Features**
- 📋 Deep learning models (BERT, transformer-based)
- 📋 Few-shot learning for new intent types
- 📋 Semantic similarity for test case matching
- 📋 Automated test failure analysis

## 📈 AI Performance Metrics & Validation

### **Model Evaluation Strategy**
1. **Cross-validation**: K-fold validation on expanded dataset
2. **Intent Distribution**: Balanced sampling across categories
3. **Edge Case Testing**: Ambiguous and complex prompts
4. **Production Monitoring**: Real-world accuracy tracking

### **Success Criteria**
- **Accuracy**: >90% on validation set
- **Precision**: >85% per intent class
- **Latency**: <100ms prediction time
- **Robustness**: Handles typos and variations

## 🔧 AI Development Tools & Environment

### **Machine Learning Stack**
- **scikit-learn**: Core ML framework
- **joblib**: Model serialization
- **numpy**: Numerical computations
- **pandas**: Data manipulation (future)

### **Development Workflow**
1. Data collection and annotation
2. Feature engineering experimentation
3. Model training and hyperparameter tuning
4. Evaluation and validation
5. Deployment and monitoring

---

**This AI model serves as the intelligent core of the self-healing test framework, enabling natural language test specification and automated test plan generation through machine learning.**
