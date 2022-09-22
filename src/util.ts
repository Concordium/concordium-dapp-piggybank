import {err, ok, Result} from "neverthrow";

export function resultFromTruthy<T>(input: T): Result<T, undefined> {
    if (input) {
        return ok(input);
    }
    return err(undefined);
}
