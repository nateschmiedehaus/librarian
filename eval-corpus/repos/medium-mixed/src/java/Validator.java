package validator;

import java.util.List;
import java.util.Map;

public class Validator {
    public static void requireFields(Map<String, Object> record, List<String> required) {
        for (String key : required) {
            if (!record.containsKey(key)) {
                throw new IllegalArgumentException("missing field: " + key);
            }
        }
    }

    public static void validateRange(String field, int value, int min, int max) {
        if (value < min || value > max) {
            throw new IllegalArgumentException(
                field + " out of range " + value + " (" + min + "-" + max + ")"
            );
        }
    }

    public static void validateEnum(String field, String value, List<String> allowed) {
        if (!allowed.contains(value)) {
            throw new IllegalArgumentException(
                field + " not in allowed values: " + value
            );
        }
    }
}
