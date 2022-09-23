import {err, ok, Result} from "neverthrow";

export function resultFromTruthy<T, E = string>(value: T | undefined, msg: E): Result<T, E> {
    if (value) {
        return ok(value);
    }
    return err(msg);
}
