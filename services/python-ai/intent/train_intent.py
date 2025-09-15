import json, random, pathlib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
from joblib import dump

random.seed(42)

DATA = [
    # LOGIN
    ("login", "LOGIN"),
    ("log in to the application", "LOGIN"),
    ("sign in", "LOGIN"),
    ("please login to the site", "LOGIN"),

    # OPEN
    ("open example", "OPEN"),
    ("visit https://example.com", "OPEN"),
    ("go to the internet herokuapp login page", "OPEN"),
    ("open this url https://the-internet.herokuapp.com/login", "OPEN"),

    # VERIFY TITLE
    ("verify title contains example", "VERIFY_TITLE"),
    ("assert title has text internet", "VERIFY_TITLE"),
    ("check the title for example domain", "VERIFY_TITLE"),

    # UNKNOWN
    ("purchase insurance", "UNKNOWN"),
    ("book a hotel", "UNKNOWN"),
]

X = [t for t, _ in DATA]
y = [l for _, l in DATA]

model = Pipeline(steps=[
    ("tfidf", TfidfVectorizer(ngram_range=(1,2), min_df=1)),
    ("clf", LinearSVC()),
])

model.fit(X, y)
pred = model.predict(X)
print(classification_report(y, pred))

# Save
outdir = pathlib.Path("models")
outdir.mkdir(exist_ok=True)
dump(model, outdir / "intent_model.joblib")
print("Saved models/intent_model.joblib")
