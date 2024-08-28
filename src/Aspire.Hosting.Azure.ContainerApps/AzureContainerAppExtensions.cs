// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

using Aspire.Hosting.ApplicationModel;

namespace Aspire.Hosting.Azure;

/// <summary>
/// 
/// </summary>
public static class AzureContainerAppExtensions
{
    /// <summary>
    /// 
    /// </summary>
    /// <param name="project"></param>
    /// <returns></returns>
    public static IResourceBuilder<ProjectResource> PublishAsContainerApp(this IResourceBuilder<ProjectResource> project)
    {
        if (!project.ApplicationBuilder.ExecutionContext.IsPublishMode)
        {
            return project;
        }

        var containerAppResource = new AzureContainerAppResource(project.Resource.Name + "-containerApp", "");

        project.ApplicationBuilder.CreateResourceBuilder(containerAppResource)
            .WithManifestPublishingCallback(containerAppResource.WriteToManifest);

        project.WithAnnotation(new DeploymentTargetAnnotation(containerAppResource));

        return project;
    }

    /// <summary>
    /// 
    /// </summary>
    /// <param name="container"></param>
    /// <returns></returns>
    public static IResourceBuilder<T> PublishAsContainerApp<T>(this IResourceBuilder<T> container) where T : ContainerResource
    {
        if (!container.ApplicationBuilder.ExecutionContext.IsPublishMode)
        {
            return container;
        }

        var containerAppResource = new AzureContainerAppResource(container.Resource.Name + "-containerApp", "");

        container.ApplicationBuilder.CreateResourceBuilder(containerAppResource)
            .WithManifestPublishingCallback(containerAppResource.WriteToManifest);

        container.WithAnnotation(new DeploymentTargetAnnotation(containerAppResource));

        return container;
    }
}
