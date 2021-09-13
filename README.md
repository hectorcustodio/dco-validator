# DCO / GPG Validator

> A GitHub App built with [Probot](https://github.com/probot/probot) that A Probot app

## What is this App for?

This app helps you check pull request commits signatures for DCO (Developer Certificate of Origin) and GPG verification

For default, GPG validation is disabled but you can easily change that:

Inside the .github folder of your default branch, create the following file:

dco-validation.yml
```sh
#enables gpg verification
verify:
  gpg: true
```

## Local Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t dco-validator .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> dco-validator
```

## Contributing

If you have suggestions for how dco-validator could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2021 Hector Custódio <hectorcustodio@outlook.com.br>
