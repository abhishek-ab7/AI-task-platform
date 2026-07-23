from collections import Counter


def process_task(operation_type: str, input_text: str):
    if input_text is None:
        input_text = ""

    if operation_type == "UPPERCASE":
        return input_text.upper()
    elif operation_type == "LOWERCASE":
        return input_text.lower()
    elif operation_type == "REVERSE_STRING":
        return input_text[::-1]
    elif operation_type == "WORD_COUNT":
        words = input_text.split()
        word_count = len(words)
        frequencies = dict(Counter(words))
        unique_words = len(frequencies)
        return {
            "wordCount": word_count,
            "uniqueWords": unique_words,
            "frequencies": frequencies,
        }
    else:
        raise ValueError(f"Unsupported operation type: {operation_type}")
