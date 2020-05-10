import { countResources, expect as expectCDK, haveResource, ResourcePart } from '@aws-cdk/assert';
import { App } from '@aws-cdk/core';

import { ApigCrudStack } from './apig-crud-stack';

const modelName = 'Kitten';

describe('DynamoDB Table', () => {
  const app = new App();
  const stack = new ApigCrudStack(app, 'MyTestStack');

  test('Create table', () => {
    expectCDK(stack).to(
      haveResource(
        'AWS::DynamoDB::Table',
        {
          Properties: {
            KeySchema: [
              {
                AttributeName: `${modelName}Id`,
                KeyType: 'HASH',
              },
            ],
            AttributeDefinitions: [
              {
                AttributeName: `${modelName}Id`,
                AttributeType: 'S',
              },
            ],
            BillingMode: 'PAY_PER_REQUEST',
            TableName: modelName,
          },
          UpdateReplacePolicy: 'Delete',
          DeletionPolicy: 'Delete',
        },
        ResourcePart.CompleteDefinition,
        true,
      ),
    );
  });
});

describe('Roles', () => {
  const app = new App();
  const stack = new ApigCrudStack(app, 'MyTestStack');

  test('Count policies and roles', () => {
    expectCDK(stack).to(countResources('AWS::IAM::Policy', 4));
    expectCDK(stack).to(countResources('AWS::IAM::Role', 5));
  });

  test.each`
    action
    ${'DeleteItem'}
    ${'GetItem'}
    ${'PutItem'}
    ${'Scan'}
  `('Generates a policy with $action', ({ action }) => {
    expectCDK(stack).to(
      haveResource(
        'AWS::IAM::Policy',
        {
          PolicyDocument: {
            Statement: [
              {
                Action: `dynamodb:${action}`,
                Effect: 'Allow',
              },
            ],
          },
        },
        ResourcePart.Properties,
        true,
      ),
    );
  });
});

describe('Api Gateway', () => {
  const app = new App();
  const stack = new ApigCrudStack(app, 'MyTestStack');

  test('Create Gateway', () => {
    expectCDK(stack).to(
      haveResource(
        'AWS::ApiGateway::RestApi',
        {
          Name: `${modelName} Service`,
        },
        ResourcePart.Properties,
        true,
      ),
    );
  });

  test('Deployment', () => {
    expectCDK(stack).to(countResources('AWS::ApiGateway::Account', 1));
    expectCDK(stack).to(countResources('AWS::ApiGateway::Deployment', 1));
    expectCDK(stack).to(countResources('AWS::ApiGateway::Stage', 1));
  });

  test('Count methods', () => {
    expectCDK(stack).to(countResources('AWS::ApiGateway::Method', 8));
  });

  test('Count resources', () => {
    expectCDK(stack).to(countResources('AWS::ApiGateway::Resource', 2));
  });

  test.each`
    part
    ${modelName.toLowerCase()}
    ${'{id}'}
  `('Maps $part to a resource', ({ part }) => {
    expectCDK(stack).to(
      haveResource(
        'AWS::ApiGateway::Resource',
        {
          PathPart: part,
        },
        ResourcePart.Properties,
        true,
      ),
    );
  });

  test.each`
    httpMethod   | authorizationType | type
    ${'OPTIONS'} | ${'NONE'}         | ${'MOCK'}
    ${'DELETE'}  | ${'NONE'}         | ${'AWS'}
    ${'GET'}     | ${'NONE'}         | ${'AWS'}
    ${'PUT'}     | ${'NONE'}         | ${'AWS'}
    ${'GET'}     | ${'NONE'}         | ${'AWS'}
    ${'POST'}    | ${'NONE'}         | ${'AWS'}
  `(
    'Adds $httpMethod with authorization: $authorizationType to $type endpoint',
    ({ httpMethod, authorizationType, type }) => {
      expectCDK(stack).to(
        haveResource(
          'AWS::ApiGateway::Method',
          {
            HttpMethod: httpMethod,
            AuthorizationType: authorizationType,
            Integration: { Type: type },
          },
          ResourcePart.Properties,
          true,
        ),
      );
    },
  );
});
