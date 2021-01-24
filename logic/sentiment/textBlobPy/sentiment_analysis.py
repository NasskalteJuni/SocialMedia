import nltk
from textblob import Blobber
from textblob.sentiments import NaiveBayesAnalyzer
from textblob import Word
import sys
import json

# load some necessary models for our analysis
nltk.download('movie_reviews')
nltk.download('punkt')
nltk.download('brown')
nltk.download('wordnet')
nltk.download('averaged_perceptron_tagger')

# prepare a Sentiment Analyzer (do it here to avoid training it for every received post)
textblob = Blobber(analyzer=NaiveBayesAnalyzer())

while True:
    post = json.loads(sys.stdin.readline())
    blob = textblob(post["text"])
    emotion, polarity, subjectivity = blob.sentiment

    post["emotion"] = str(emotion)
    post["score"] = polarity if emotion == "pos" else -polarity
    nouns = [tag[0] for tag in blob.tags if tag[1] in ("NN", "NNS", "NNP", "NNPS")]
    post["keywords"] = [Word(word).lemmatize() for word in nouns]
    sys.stdout.write(json.dumps(post))
    sys.stdout.flush()
