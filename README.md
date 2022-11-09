# Piggy Bank Web Application

Example dApp for showcasing how to integrate with a smart contract on the Concordium blockchain.
The application supports integration with the [Browser Wallet](https://github.com/Concordium/concordium-browser-wallet/)
and with the Mobile Wallets via Wallet Connect.

The project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Install

Run `yarn` in the root of the project.

## Run

Run the app in development mode with

```shell
yarn start
```

This spins up a server which serves the app on [http://localhost:3000](http://localhost:3000).

Linting errors will appear in the console.

Changes to the source code will cause the page to refresh automatically.

## Build

Build the app for production using

```shell
yarn build
```

This will drop an optimized and minified bundle in the `build` folder that is ready to be deployed.

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### Docker

The project includes a dockerfile for building the app for production and running it in a container.
The default build image `node:16-slim` may be overridden using build arg `build_image`.

The easiest way to build and run the app is with Docker Compose:

```shell
docker-compose up --build
```

This command will build the app with default settings and deploy it in a HTTPd server container on running on port 8080 (by default).

The Compose spec is parameterized as follows:

- `PIGGYBANK_IMAGE` (default: `piggybank:test`): Image to build and/or start. Remove the `--build` flag to start an existing image without building it.
- `PIGGYBANK_PORT` (default: `8080`): Port to run the server on.
