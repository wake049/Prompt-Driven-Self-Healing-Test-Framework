"""
Advanced ML Model Evaluation for Intent Classification
Demonstrates proper AI model development practices
"""
import numpy as np
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
import joblib
import pathlib

# Expanded training data (demonstrating larger dataset)
TRAINING_DATA = [
    # LOGIN variations (8 samples)
    ("login", "LOGIN"),
    ("log in to the application", "LOGIN"),
    ("sign in", "LOGIN"),
    ("please login to the site", "LOGIN"),
    ("authenticate user", "LOGIN"),
    ("user authentication", "LOGIN"),
    ("access the system", "LOGIN"),
    ("sign into account", "LOGIN"),

    # OPEN variations (8 samples)
    ("open example", "OPEN"),
    ("visit https://example.com", "OPEN"),
    ("go to the internet herokuapp login page", "OPEN"),
    ("open this url https://the-internet.herokuapp.com/login", "OPEN"),
    ("navigate to website", "OPEN"),
    ("browse to page", "OPEN"),
    ("load the application", "OPEN"),
    ("access the homepage", "OPEN"),

    # VERIFY_TITLE variations (6 samples)
    ("verify title contains example", "VERIFY_TITLE"),
    ("assert title has text internet", "VERIFY_TITLE"),
    ("check the title for example domain", "VERIFY_TITLE"),
    ("validate page title", "VERIFY_TITLE"),
    ("confirm title text", "VERIFY_TITLE"),
    ("ensure title matches", "VERIFY_TITLE"),

    # FORM_FILL (new category - 4 samples)
    ("fill out the contact form", "FORM_FILL"),
    ("enter user details", "FORM_FILL"),
    ("complete registration form", "FORM_FILL"),
    ("input personal information", "FORM_FILL"),

    # UNKNOWN variations (4 samples)
    ("purchase insurance", "UNKNOWN"),
    ("book a hotel", "UNKNOWN"),
    ("order pizza", "UNKNOWN"),
    ("schedule appointment", "UNKNOWN"),
]

def train_and_evaluate_model():
    """
    Train intent classification model with proper ML evaluation
    """
    print("🤖 Training Custom Intent Classification Model")
    print("=" * 50)
    
    # Prepare data
    X = [text for text, _ in TRAINING_DATA]
    y = [label for _, label in TRAINING_DATA]
    
    print(f"📊 Dataset: {len(X)} samples across {len(set(y))} categories")
    for label in set(y):
        count = y.count(label)
        print(f"   {label}: {count} samples ({count/len(y)*100:.1f}%)")
    
    # Create ML pipeline
    model = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1,2), min_df=1)),
        ("clf", LinearSVC(random_state=42, max_iter=2000))
    ])
    
    # Cross-validation evaluation
    print("\n🔄 Cross-Validation Results:")
    cv_scores = cross_val_score(model, X, y, cv=3, scoring='accuracy')
    print(f"   CV Accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
    
    # Train/test split evaluation
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    
    # Train model
    model.fit(X_train, y_train)
    
    # Evaluate on test set
    y_pred = model.predict(X_test)
    
    print(f"\n📈 Test Set Performance:")
    print(f"   Training samples: {len(X_train)}")
    print(f"   Test samples: {len(X_test)}")
    print(f"   Test Accuracy: {model.score(X_test, y_test):.3f}")
    
    print(f"\n📋 Detailed Classification Report:")
    print(classification_report(y_test, y_pred))
    
    # Feature analysis
    vectorizer = model.named_steps['tfidf']
    feature_names = vectorizer.get_feature_names_out()
    print(f"\n🔤 Feature Engineering:")
    print(f"   Total features extracted: {len(feature_names)}")
    print(f"   N-gram range: {vectorizer.ngram_range}")
    print(f"   Sample features: {feature_names[:10].tolist()}")
    
    # Retrain on full dataset for deployment
    model.fit(X, y)
    
    # Save model
    model_dir = pathlib.Path("models")
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / "intent_model.joblib"
    joblib.dump(model, model_path)
    
    print(f"\n💾 Model saved: {model_path}")
    print(f"   Model size: {model_path.stat().st_size / 1024:.1f} KB")
    
    # Test some predictions
    test_prompts = [
        "please sign in",
        "open the website", 
        "check page title",
        "fill the form",
        "buy groceries"
    ]
    
    print(f"\n🧪 Sample Predictions:")
    for prompt in test_prompts:
        pred = model.predict([prompt])[0]
        confidence = max(model.predict_proba([prompt])[0])
        print(f"   '{prompt}' → {pred} (confidence: {confidence:.3f})")
    
    return model

if __name__ == "__main__":
    model = train_and_evaluate_model()
    print("\n✅ Custom AI model training completed!")
