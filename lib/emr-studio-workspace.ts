import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as emr from 'aws-cdk-lib/aws-emr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { WorkspaceBucket } from './s3-storage';
import { EmrStudioEngineSecurityGroup, EmrStudioWorkspaceSecurityGroup } from './emr-studio-sgs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';

export enum StudioAuthMode {
    AWS_SSO = 'SSO',
    AWS_IAM = 'IAM'
}

export class EmrStudioWorkspace extends Construct {

    public readonly emrStudio: emr.CfnStudio;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        // setup networking configuration
        const baseVpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });
        const defaultSubnetIds: Array<string> = [];

        (baseVpc.publicSubnets.slice(0, 4)).forEach((subnet) => {
            defaultSubnetIds.push(subnet.subnetId);
        });

        const workSpaceSecurityGroup = new EmrStudioWorkspaceSecurityGroup(this, 'Workspace', { vpc: baseVpc });
        const engineSecurityGroup = new EmrStudioEngineSecurityGroup(this, 'Engine', { vpc: baseVpc });
        workSpaceSecurityGroup.securityGroup.connections.allowTo(engineSecurityGroup.securityGroup, ec2.Port.tcp(18888), 'Allow traffic to any resources in the Engine security group for EMR Studio.');
        workSpaceSecurityGroup.securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow traffic to the internet to link publicly hosted Git repositories to Workspaces.');

        this.addProperTag(workSpaceSecurityGroup);
        this.addProperTag(engineSecurityGroup);
        const taggingExpert = new EmrStudioTaggingExpert(this, 'TaggingExpert');
        const lambdaInvoker = new cr.Provider(this, 'LambdaInvoker', {
            onEventHandler: taggingExpert.functionEntity,
            logRetention: logs.RetentionDays.THREE_MONTHS,
        });
        new cdk.CustomResource(this, 'TagVpcSubnetCr', {
            serviceToken: lambdaInvoker.serviceToken,
            resourceType: 'Custom::TagVpcSubnets',
            properties: {
                VpcId: baseVpc.vpcId,
                SubnetIds: defaultSubnetIds.toString(),
            },
        });

        const workspaceBucket = new WorkspaceBucket(this, 'WorkspaceBucket');
        const emrStudioServiceRole = new EmrStudioServiceRole(this, 'Service', {
            workSpaceBucket: workspaceBucket
        });

        const engineSecurityGroupId = engineSecurityGroup.securityGroup.securityGroupId;
        const workspaceSecurityGroupId = workSpaceSecurityGroup.securityGroup.securityGroupId;
        const serviceRoleArn = emrStudioServiceRole!.roleEntity.roleArn;

        const emrStudio = new emr.CfnStudio(this, 'EmrStudioWorkspace', {
            authMode: StudioAuthMode.AWS_IAM,
            defaultS3Location: `s3://${workspaceBucket.bucketEntity.bucketName}/`,
            engineSecurityGroupId: engineSecurityGroupId,
            name: 'emr-studio-quicklaunch',
            serviceRole: serviceRoleArn,
            subnetIds: defaultSubnetIds,
            vpcId: baseVpc.vpcId,
            workspaceSecurityGroupId: workspaceSecurityGroupId
        });

        new cdk.CfnOutput(this, 'EmrStudioArn', { value: cdk.stringToCloudFormation(emrStudio.getAtt('Arn')), description: 'The ARN of the EMR Studio' });
        new cdk.CfnOutput(this, 'EmrStudioId', { value: cdk.stringToCloudFormation(emrStudio.getAtt('StudioId')), description: 'The ID of the Amazon EMR Studio.' });
        new cdk.CfnOutput(this, 'EmrStudioUrl', { value: cdk.stringToCloudFormation(emrStudio.getAtt('Url')), description: 'The unique access URL of the Amazon EMR Studio.' });
    }

    private addProperTag = (entity: Construct) => {
        cdk.Tags.of(entity).add('for-use-with-amazon-emr-managed-policies', 'true');
    };

}

export interface EmrStudioServiceRoleProps {
    readonly workSpaceBucket: WorkspaceBucket;
}

export class EmrStudioServiceRole extends Construct {
    public readonly roleEntity: iam.Role;
    constructor(scope: Construct, name: string, props: EmrStudioServiceRoleProps) {
        super(scope, name);
        this.roleEntity = new iam.Role(this, 'IamRole', {
            roleName: 'Emr-Studio-Quick-Demo-Service-Role',
            assumedBy: new iam.ServicePrincipal('elasticmapreduce.amazonaws.com', {
                conditions: {
                    ['StringEquals']: {
                        'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
                    },
                    ['ArnLike']: {
                        'aws:SourceArn': `arn:aws:elasticmapreduce:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*`,
                    },
                },
            }),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEMRServicePolicy_v2'),
            ],
            inlinePolicies: {
                ['emr-studio-quick-demo-additional-policy']: new iam.PolicyDocument({
                    assignSids: true,
                    statements: [
                        new iam.PolicyStatement({
                            sid: 'AllowEMRReadOnlyActions',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'elasticmapreduce:ListInstances',
                                'elasticmapreduce:DescribeCluster',
                                'elasticmapreduce:ListSteps',
                            ],
                            resources: [
                                '*',
                            ],
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowEC2ENIActionsWithEMRTags',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:CreateNetworkInterfacePermission',
                                'ec2:DeleteNetworkInterface',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:network-interface/*`,
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:ResourceTag/for-use-with-amazon-emr-managed-policies': 'true',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowEC2ENIAttributeAction',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:ModifyNetworkInterfaceAttribute',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:instance/*`,
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:network-interface/*`,
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:security-group/*`,
                            ],
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowEC2SecurityGroupActionsWithEMRTags',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:AuthorizeSecurityGroupEgress',
                                'ec2:AuthorizeSecurityGroupIngress',
                                'ec2:RevokeSecurityGroupEgress',
                                'ec2:RevokeSecurityGroupIngress',
                                'ec2:DeleteNetworkInterfacePermission',
                            ],
                            resources: [
                                '*',
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:ResourceTag/for-use-with-amazon-emr-managed-policies': 'true',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowDefaultEC2SecurityGroupsCreationWithEMRTags',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:AuthorizeSecurityGroupEgress',
                                'ec2:AuthorizeSecurityGroupIngress',
                                'ec2:RevokeSecurityGroupEgress',
                                'ec2:RevokeSecurityGroupIngress',
                                'ec2:DeleteNetworkInterfacePermission',
                            ],
                            resources: [
                                '*',
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:RequestTag/for-use-with-amazon-emr-managed-policies': 'true',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowDefaultEC2SecurityGroupsCreationInVPCWithEMRTags',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:CreateSecurityGroup',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:vpc/*`,
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:ResourceTag/for-use-with-amazon-emr-managed-policies': 'true',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowAddingEMRTagsDuringDefaultSecurityGroupCreation',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:CreateTags',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:security-group/*`,
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:RequestTag/for-use-with-amazon-emr-managed-policies': 'true',
                                    'ec2:CreateAction': 'CreateSecurityGroup',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowEC2ENICreationWithEMRTags',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:CreateNetworkInterface',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:network-interface/*`,
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:RequestTag/for-use-with-amazon-emr-managed-policies': 'true',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowEC2ENICreationInSubnetAndSecurityGroupWithEMRTags',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:CreateNetworkInterface',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:subnet/*`,
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:security-group/*`,
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:ResourceTag/for-use-with-amazon-emr-managed-policies': 'true',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowAddingTagsDuringEC2ENICreation',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:CreateTags',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:ec2:*:*:network-interface/*`,
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'ec2:CreateAction': 'CreateNetworkInterface',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowEC2ReadOnlyActions',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'ec2:DescribeSecurityGroups',
                                'ec2:DescribeNetworkInterfaces',
                                'ec2:DescribeTags',
                                'ec2:DescribeInstances',
                                'ec2:DescribeSubnets',
                                'ec2:DescribeVpcs',
                            ],
                            resources: [
                                '*',
                            ],
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowSecretsManagerReadOnlyActionsWithEMRTags',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'secretsmanager:GetSecretValue',
                            ],
                            resources: [
                                `arn:${cdk.Aws.PARTITION}:secretsmanager:*:*:secret:*`,
                            ],
                            conditions: {
                                ['StringEquals']: {
                                    'aws:ResourceTag/for-use-with-amazon-emr-managed-policies': 'true',
                                },
                            },
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowWorkspaceCollaboration',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'iam:GetUser',
                                'iam:GetRole',
                                'iam:ListUsers',
                                'iam:ListRoles',
                                'sso:GetManagedApplicationInstance',
                                'sso-directory:SearchUsers',
                            ],
                            resources: [
                                '*',
                            ],
                        }),
                        new iam.PolicyStatement({
                            sid: 'AllowWorkspaceBucketPermissions',
                            effect: iam.Effect.ALLOW,
                            actions: [
                                's3:PutObject',
                                's3:GetObject',
                                's3:GetEncryptionConfiguration',
                                's3:ListBucket',
                                's3:DeleteObject',
                            ],
                            resources: [
                                `${props.workSpaceBucket.bucketEntity.bucketArn}`,
                                `${props.workSpaceBucket.bucketEntity.bucketArn}/*`,
                            ],
                        }),
                    ],
                }),
            },
        });
        new cdk.CfnOutput(this, 'EmrStudioServiceRoleArn', { value: this.roleEntity.roleArn, description: 'The ARN of the servcie role used by the EMR Studio for quick demo.' });
    }
}

export class EmrStudioTaggingExpert extends Construct {

    public readonly functionEntity: lambda.Function;

    constructor(scope: Construct, name: string) {
        super(scope, name);

        const lambdaRole = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'An execution role for the Lambda function which tags specific resources for the EMR Studio.',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
            ],
            roleName: 'Tagging-Expert-Role',
            inlinePolicies: {
                LambdaForBranchPolicy: new iam.PolicyDocument({
                    assignSids: true,
                    statements: [new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['ec2:CreateTags', 'ec2:DeleteTags'],
                        resources: [`arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:vpc/*`,
                        `arn:${cdk.Aws.PARTITION}:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:subnet/*`],
                    })],
                }),
            },
        });

        this.functionEntity = new lambda.Function(this, 'Function', {
            functionName: 'emr-studio-tagging-specific-resources',
            description: 'Tags specific EC2 resources, i.e., the VPC and subnets for the EMR Studio.',
            logRetention: logs.RetentionDays.THREE_MONTHS,
            runtime: lambda.Runtime.PYTHON_3_9,
            architecture: lambda.Architecture.ARM_64,
            code: lambda.Code.fromInline('import json\r\nfrom typing import List\r\n\r\nimport boto3\r\nfrom botocore.exceptions import ClientError, ParamValidationError\r\n\r\n\r\ndef lambda_handler(event, context):\r\n    print(json.dumps(event, indent=4))\r\n    request_type = event["RequestType"]\r\n    props = event["ResourceProperties"]\r\n    vpc_id: str = props.get(\'VpcId\')\r\n    subnet_ids: List[str] = props.get(\'SubnetIds\').split(\',\')\r\n    resources_list = [vpc_id] + subnet_ids\r\n    ec2_client = boto3.client(\'ec2\')\r\n    if(request_type in [\'Create\']):\r\n        try:\r\n            response = ec2_client.create_tags(\r\n                Resources=resources_list,\r\n                Tags=[\r\n                    {\r\n                        \'Key\': \'for-use-with-amazon-emr-managed-policies\',\r\n                        \'Value\': \'true\'\r\n                    }\r\n                ]\r\n            )\r\n            metadata = response.get(\'ResponseMetadata\')\r\n            status_code = metadata.get(\'HTTPStatusCode\')\r\n            print(f\'HTTP status code: {status_code}\')\r\n            if status_code == 200:\r\n                resources = \',\'.join(resources_list)\r\n                tag_value = json.dumps({\r\n                    \'Key\': \'for-use-with-amazon-emr-managed-policies\',\r\n                    \'Value\': \'true\'\r\n                }, indent=4)\r\n                print(f\'{resources} has been added {tag_value}\')\r\n        except ClientError as e:\r\n            print(f\'Unexpected error: {e}\')\r\n        except ParamValidationError as e:\r\n            print(f\'Parameter validation error: {e}\')\r\n    if(request_type == \'Delete\'):\r\n        try:\r\n            response = ec2_client.delete_tags(\r\n                Resources=resources_list,\r\n                Tags=[\r\n                    {\r\n                        \'Key\': \'for-use-with-amazon-emr-managed-policies\',\r\n                        \'Value\': \'true\'\r\n                    }\r\n                ]\r\n            )\r\n            metadata = response.get(\'ResponseMetadata\')\r\n            status_code = metadata.get(\'HTTPStatusCode\')\r\n            print(f\'HTTP status code: {status_code}\')\r\n            if status_code == 200:\r\n                resources = \',\'.join(resources_list)\r\n                tag_value = json.dumps({\r\n                    \'Key\': \'for-use-with-amazon-emr-managed-policies\',\r\n                    \'Value\': \'true\'\r\n                }, indent=4)\r\n                print(f\'{resources} has been removed {tag_value}\')\r\n        except ClientError as e:\r\n            print(f\'Unexpected error: {e}\')\r\n        except ParamValidationError as e:\r\n            print(f\'Parameter validation error: {e}\')\r\n'),
            handler: 'index.lambda_handler',
            memorySize: 128,
            role: lambdaRole,
            timeout: cdk.Duration.seconds(20),
            tracing: lambda.Tracing.ACTIVE,
        });
    }
}