// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

namespace Aspire.Hosting.Azure;

/// <summary>
/// 
/// </summary>
/// <param name="name"></param>
/// <param name="templateString"></param>
public class AzureContainerAppResource(string name, string templateString) : AzureBicepResource(name, templateString: templateString)
{

}
