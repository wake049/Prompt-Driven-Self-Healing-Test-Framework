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

    # OPEN - Enhanced with user scenarios
    ("open example", "OPEN"),
    ("visit https://example.com", "OPEN"),
    ("go to the internet herokuapp login page", "OPEN"),
    ("open this url https://the-internet.herokuapp.com/login", "OPEN"),
    ("Open Google and verify that the page title contains Google", "OPEN"),
    ("open https://www.google.com", "OPEN"),

    # VERIFY TITLE
    ("verify title contains example", "VERIFY_TITLE"),
    ("assert title has text internet", "VERIFY_TITLE"),
    ("check the title for example domain", "VERIFY_TITLE"),
    ("verify that the page title contains Google", "VERIFY_TITLE"),

    # SEARCH - New intent for user scenarios
    ("Search for laptops on Amazon and verify results are shown", "SEARCH"),
    ("search for products", "SEARCH"),
    ("find items on website", "SEARCH"),
    ("look for products", "SEARCH"),

    # FORM - New intent for form filling
    ("Fill out the contact form with name John Doe and email john@example.com", "FORM"),
    ("fill out form", "FORM"),
    ("complete contact form", "FORM"),
    ("enter information in form", "FORM"),

    # NAVIGATION - Enhanced
    ("navigate to website", "OPEN"),
    ("go to page", "OPEN"),
    ("visit site", "OPEN"),

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
