# emr-studio

AWS CDK constructs to deploy an EMR Studio environment.

## Table of Contents
- [emr-studio](#emr-studio)
  * [Table of Contents](#table-of-contents)
  * [Description](#description)
  * [Quickstart](#quickstart)
  * [Installation](#installation)
    + [Prerequisites](#prerequisites)
    + [Environment Variables](#environment-variables)
    + [AWS Credentials](#aws-credentials)
  * [AWS Deployment](#aws-deployment)
  * [References & Links](#references---links)
  * [Authors](#authors)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

## Description
This project will deploy an EMR Studio environment which can be attached to an EMR cluster for developing distributed applications. 

From the [docs](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-studio.html):
> Amazon EMR Studio is a web-based integrated development environment (IDE) for fully managed Jupyter notebooks that run on Amazon EMR clusters. You can set up an EMR Studio for your team to develop, visualize, and debug applications written in R, Python, Scala, and PySpark. EMR Studio is integrated with AWS Identity and Access Management (IAM) and IAM Identity Center so users can log in using their corporate credentials.

## Quickstart
1. Configure your AWS credentials.
2. Add the required environment variables.
3. Run `cdk deploy` to deploy the infrastructure.
4. [Create an EMR cluster](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-launch-with-quick-options.html).
5. Log into the AWS EMR Studio console and create a workspace. Attach the workspace to the cluster.

## Installation
Follow the steps to set the deployment environment.

### Prerequisites
* AWS CDK

### Environment Variables

Sensitive environment variables containing secrets like passwords and API keys must be exported to the environment first.

Create a `.env` file in the project root.
```bash
CDK_DEFAULT_ACCOUNT=<AWS Account ID>
CDK_DEFAULT_REGION=<AWS region>
```

***Important:*** *Always use a `.env` file or AWS SSM Parameter Store or Secrets Manager for sensitive variables like credentials and API keys. Never hard-code them, including when developing. AWS will quarantine an account if any credentials get accidentally exposed and this will cause problems.*

***Make sure that `.env` is listed in `.gitignore`***

### AWS Credentials
Valid AWS credentials must be available to AWS CLI and SAM CLI. The easiest way to do this is running `aws configure`, or by adding them to `~/.aws/credentials` and exporting the `AWS_PROFILE` variable to the environment.

For more information visit the documentation page:
[Configuration and credential file settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)

## AWS Deployment
Once an AWS profile is configured and environment variables are exported, the application can be deployed using `cdk`.

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## References & Links
- [EMR documentation](https://docs.aws.amazon.com/emr/index.html)
- [How to use EMR Studio](https://docs.aws.amazon.com/emr/latest/ManagementGuide/use-an-emr-studio.html)
- [CloudFormation EMR documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-elasticmapreduce-cluster.html)

## Authors
**Primary Contact:** Gregory Lindsey (@abk7777)
