import { AwsIntegration, Cors, RestApi } from '@aws-cdk/aws-apigateway';
import { AttributeType, Table, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Effect, Policy, PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { Construct, RemovalPolicy, Stack, StackProps } from '@aws-cdk/core';

export class ApigCrudStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const modelName = 'Kitten';

    const dynamoTable = new Table(this, modelName, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: `${modelName}Id`,
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: modelName,
    });

    const deletePolicy = new Policy(this, 'deletePolicy', {
      statements: [
        new PolicyStatement({
          actions: ['dynamodb:DeleteItem'],
          effect: Effect.ALLOW,
          resources: [dynamoTable.tableArn],
        }),
      ],
    });

    const getPolicy = new Policy(this, 'getPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['dynamodb:GetItem'],
          effect: Effect.ALLOW,
          resources: [dynamoTable.tableArn],
        }),
      ],
    });

    const putPolicy = new Policy(this, 'putPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['dynamodb:PutItem'],
          effect: Effect.ALLOW,
          resources: [dynamoTable.tableArn],
        }),
      ],
    });

    const scanPolicy = new Policy(this, 'scanPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['dynamodb:Scan'],
          effect: Effect.ALLOW,
          resources: [dynamoTable.tableArn],
        }),
      ],
    });

    const deleteRole = new Role(this, 'deleteRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });
    deleteRole.attachInlinePolicy(deletePolicy);
    const getRole = new Role(this, 'getRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });
    getRole.attachInlinePolicy(getPolicy);
    const putRole = new Role(this, 'putRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });
    putRole.attachInlinePolicy(putPolicy);
    const scanRole = new Role(this, 'scanRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });
    scanRole.attachInlinePolicy(scanPolicy);

    const api = new RestApi(this, `${modelName}Api`, {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
      },
      restApiName: `${modelName} Service`,
    });

    const errorResponses = [
      {
        selectionPattern: '400',
        statusCode: '400',
        responseTemplates: {
          'application/json': `{
            "error": "Bad input!"
          }`,
        },
      },
      {
        selectionPattern: '5\\d{2}',
        statusCode: '500',
        responseTemplates: {
          'application/json': `{
            "error": "Internal Service Error!"
          }`,
        },
      },
    ];

    const integrationResponses = [
      {
        statusCode: '200',
      },
      ...errorResponses,
    ];

    const allResources = api.root.addResource(modelName.toLocaleLowerCase());

    const oneResource = allResources.addResource('{id}');

    const getAllIntegration = new AwsIntegration({
      action: 'Scan',
      options: {
        credentialsRole: scanRole,
        integrationResponses,
        requestTemplates: {
          'application/json': `{
              "TableName": "${modelName}"
            }`,
        },
      },
      service: 'dynamodb',
    });

    const createIntegration = new AwsIntegration({
      action: 'PutItem',
      options: {
        credentialsRole: putRole,
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{
                "requestId": "$context.requestId"
              }`,
            },
          },
          ...errorResponses,
        ],
        requestTemplates: {
          'application/json': `{
              "Item": {
                "${modelName}Id": {
                  "S": "$context.requestId"
                },
                "Name": {
                  "S": "$input.path('$.name')"
                },
                "Color": {
                  "S": "$input.path('$.color')"
                }
              },
              "TableName": "${modelName}"
            }`,
        },
      },
      service: 'dynamodb',
    });

    const deleteIntegration = new AwsIntegration({
      action: 'DeleteItem',
      options: {
        credentialsRole: deleteRole,
        integrationResponses,
        requestTemplates: {
          'application/json': `{
              "Key": {
                "${modelName}Id": {
                  "S": "$method.request.path.id"
                }
              },
              "TableName": "${modelName}"
            }`,
        },
      },
      service: 'dynamodb',
    });

    const getIntegration = new AwsIntegration({
      action: 'GetItem',
      options: {
        credentialsRole: getRole,
        integrationResponses,
        requestTemplates: {
          'application/json': `{
              "Key": {
                "${modelName}Id": {
                  "S": "$method.request.path.id"
                }
              },
              "TableName": "${modelName}"
            }`,
        },
      },
      service: 'dynamodb',
    });

    const updateIntegration = new AwsIntegration({
      action: 'PutItem',
      options: {
        credentialsRole: putRole,
        integrationResponses,
        requestTemplates: {
          'application/json': `{
              "Item": {
                "${modelName}Id": {
                  "S": "$method.request.path.id"
                },
                "Name": {
                  "S": "$input.path('$.name')"
                },
                "Color": {
                  "S": "$input.path('$.color')"
                }
              },
              "TableName": "${modelName}"
            }`,
        },
      },
      service: 'dynamodb',
    });

    const responses = { methodResponses: [{ statusCode: '200' }, { statusCode: '400' }] };

    allResources.addMethod('GET', getAllIntegration, responses);
    allResources.addMethod('POST', createIntegration, responses);

    oneResource.addMethod('DELETE', deleteIntegration, responses);
    oneResource.addMethod('GET', getIntegration, responses);
    oneResource.addMethod('PUT', updateIntegration, responses);
  }
}
