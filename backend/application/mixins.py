from rest_framework.response import Response

class ViewCountMixin:
    """
    Mixin to increment 'views' field on retrieve action.
    """
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.views += 1
        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
