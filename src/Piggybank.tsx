import { err, ok } from 'neverthrow';
import { useCallback, useEffect, useState } from 'react';
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap';
import { Hammer } from 'react-bootstrap-icons';
import { resultFromTruthy } from './util';

interface Props {
    canDeposit: boolean;
    canSmash: boolean;
    deposit: (amount: bigint) => void;
    smash: () => void;
}

export default function Piggybank(props: Props) {
    const { canDeposit, canSmash, deposit, smash } = props;
    const [depositInput, setDepositInput] = useState('');
    const [depositAmount, setDepositAmount] = useState<bigint>();
    const [validationError, setValidationError] = useState<string>();

    useEffect(() => {
        const [amount, error] = resultFromTruthy(depositInput, undefined)
            .andThen((input) => {
                const amount = Number(input);
                return Number.isNaN(amount) ? err('invalid input') : ok(amount);
            })
            .match<[bigint?, string?]>(
                (a) => [BigInt(Math.round(a * 1e6)), undefined],
                (e) => [undefined, e]
            );
        setDepositAmount(amount);
        setValidationError(error);
    }, [depositInput]);

    const handleSubmitDeposit = useCallback(() => {
        console.log(`Attempting to deposit ${depositAmount} uCCD.`);
        if (depositAmount) {
            deposit(depositAmount);
            setDepositInput('');
        }
    }, [depositAmount, deposit]);
    return (
        <Row>
            <Form.Group as={Col} md={8}>
                <InputGroup className="mb-3" hasValidation>
                    <InputGroup.Text id="basic-addon1">CCD</InputGroup.Text>
                    <Form.Control
                        type="text"
                        placeholder="Amount to deposit"
                        value={depositInput}
                        onChange={(e) => setDepositInput(e.target.value)}
                        isInvalid={Boolean(validationError)}
                    />
                    <Button variant="primary" onClick={handleSubmitDeposit} disabled={!canDeposit || !depositAmount}>
                        Deposit
                    </Button>
                    <Form.Control.Feedback type="invalid">{validationError}</Form.Control.Feedback>
                </InputGroup>
            </Form.Group>
            <Form.Group as={Col} md={4}>
                <Button variant="danger" className="w-100" onClick={smash} disabled={!canSmash || !canDeposit}>
                    <Hammer />
                </Button>
            </Form.Group>
        </Row>
    );
}
